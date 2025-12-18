import { REDIS_JOB_TTL_HOURS, REDIS_CHUNK_TTL_HOURS } from '@/constants'
import { logger } from './logger'
import { getRedis } from './redis'

// -------------------------------------------------------
// Redis Key Patterns - centralized for consistency
// -------------------------------------------------------
export const REDIS_KEYS = {
  job: (jobId: string) => `import:${jobId}`,
  chunk: (jobId: string, chunkIndex: number) =>
    `import:${jobId}:chunk:${chunkIndex}`,
  failures: (jobId: string) => `import:${jobId}:failures`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
  concurrentJobs: (identifier: string) => `concurrent:${identifier}`,
} as const

/**
 * Scan Redis keys using SCAN instead of KEYS (production-safe)
 * KEYS is O(n) and blocks Redis, SCAN is incremental
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedis()
  const keys: string[] = []
  let cursor = '0'

  do {
    const [nextCursor, foundKeys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100
    )
    cursor = nextCursor
    keys.push(...foundKeys)
  } while (cursor !== '0')

  return keys
}

/**
 * Set a Redis key with automatic TTL based on key type
 */
export async function setWithTTL(
  key: string,
  value: string,
  customTTLSeconds?: number
): Promise<void> {
  const redis = getRedis()

  let ttlSeconds: number

  if (customTTLSeconds) {
    ttlSeconds = customTTLSeconds
  } else if (key.includes(':chunk:')) {
    // Chunk data has shorter TTL
    ttlSeconds = REDIS_CHUNK_TTL_HOURS * 3600
  } else if (key.startsWith('import:')) {
    // Job data has longer TTL
    ttlSeconds = REDIS_JOB_TTL_HOURS * 3600
  } else {
    // Default TTL for other keys
    ttlSeconds = 24 * 3600 // 24 hours
  }

  await redis.setex(key, ttlSeconds, value)
}

/**
 * Set a Redis hash with automatic TTL
 */
export async function hsetWithTTL(
  key: string,
  field: string | Record<string, string | number>,
  value?: string | number,
  customTTLSeconds?: number
): Promise<void> {
  const redis = getRedis()

  let ttlSeconds: number

  if (customTTLSeconds) {
    ttlSeconds = customTTLSeconds
  } else if (key.startsWith('import:')) {
    ttlSeconds = REDIS_JOB_TTL_HOURS * 3600
  } else {
    ttlSeconds = 24 * 3600 // 24 hours
  }

  // Set the hash field(s)
  if (typeof field === 'object') {
    await redis.hset(key, field)
  } else if (value !== undefined) {
    await redis.hset(key, field, value)
  }

  // Set TTL
  await redis.expire(key, ttlSeconds)
}

/**
 * Get Redis memory usage information
 */
export async function getRedisMemoryInfo(): Promise<{
  usedMemory: number
  maxMemory: number
  usedMemoryPercentage: number
  keyCount: number
}> {
  const redis = getRedis()

  try {
    const info = await redis.info('memory')
    const dbSize = await redis.dbsize()

    // Parse memory info
    const usedMemoryMatch = info.match(/used_memory:(\d+)/)
    const maxMemoryMatch = info.match(/maxmemory:(\d+)/)

    const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0
    const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0

    const usedMemoryPercentage =
      maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0

    return {
      usedMemory,
      maxMemory,
      usedMemoryPercentage,
      keyCount: dbSize,
    }
  } catch (error) {
    logger.error('Failed to get Redis memory info', { error })
    return {
      usedMemory: 0,
      maxMemory: 0,
      usedMemoryPercentage: 0,
      keyCount: 0,
    }
  }
}

/**
 * Clean up expired import jobs and chunks
 */
export async function cleanupExpiredJobs(): Promise<{
  jobsDeleted: number
  chunksDeleted: number
}> {
  const redis = getRedis()

  try {
    // Find all import job keys using SCAN (production-safe)
    const jobKeys = await scanKeys('import:*')
    let jobsDeleted = 0
    let chunksDeleted = 0

    for (const jobKey of jobKeys) {
      // Skip chunk and failure keys
      if (jobKey.includes(':chunk:') || jobKey.includes(':failures')) continue

      // Check if job is old enough to clean up
      const jobData = await redis.hgetall(jobKey)
      if (!jobData.createdAt) continue

      const createdAt = parseInt(jobData.createdAt)
      const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60)

      // Clean up jobs older than TTL + 1 hour buffer
      // Also clean up stuck "processing" jobs older than 2 hours
      const isStuckProcessing = jobData.status === 'processing' && ageHours > 2
      const isExpired = ageHours > REDIS_JOB_TTL_HOURS + 1

      if (isExpired || isStuckProcessing) {
        // Find and delete associated chunks and failures
        const jobId = jobKey.replace('import:', '')
        const chunkKeys = await scanKeys(`import:${jobId}:chunk:*`)
        const failureKey = REDIS_KEYS.failures(jobId)

        if (chunkKeys.length > 0) {
          await redis.del(...chunkKeys)
          chunksDeleted += chunkKeys.length
        }

        // Delete failure list and job data
        await redis.del(failureKey, jobKey)
        jobsDeleted++
      }
    }

    return { jobsDeleted, chunksDeleted }
  } catch (error) {
    logger.error('Failed to cleanup expired jobs', { error })
    return { jobsDeleted: 0, chunksDeleted: 0 }
  }
}

/**
 * Delete a specific import job and all its associated data
 */
export async function deleteJob(jobId: string): Promise<{
  success: boolean
  chunksDeleted: number
  error?: string
}> {
  const redis = getRedis()

  try {
    const jobKey = REDIS_KEYS.job(jobId)

    // Check if job exists
    const exists = await redis.exists(jobKey)
    if (!exists) {
      return { success: false, chunksDeleted: 0, error: 'Job not found' }
    }

    // Find and delete associated chunks
    const chunkKeys = await scanKeys(`import:${jobId}:chunk:*`)
    let chunksDeleted = 0

    if (chunkKeys.length > 0) {
      await redis.del(...chunkKeys)
      chunksDeleted = chunkKeys.length
    }

    // Delete failure list and job data
    const failureKey = REDIS_KEYS.failures(jobId)
    await redis.del(failureKey, jobKey)

    logger.info('Job deleted manually', { jobId, chunksDeleted })

    return { success: true, chunksDeleted }
  } catch (error) {
    logger.error('Failed to delete job', { jobId, error })
    return {
      success: false,
      chunksDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get import job statistics
 */
export async function getImportJobStats(): Promise<{
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  totalChunks: number
}> {
  const redis = getRedis()

  try {
    // Use SCAN instead of KEYS for production safety
    const jobKeys = await scanKeys('import:*')
    const chunkKeys = jobKeys.filter((key) => key.includes(':chunk:'))
    const jobDataKeys = jobKeys.filter(
      (key) => !key.includes(':chunk:') && !key.includes(':failures')
    )

    let activeJobs = 0
    let completedJobs = 0
    let failedJobs = 0

    for (const jobKey of jobDataKeys) {
      const status = await redis.hget(jobKey, 'status')
      switch (status) {
        case 'processing':
        case 'pending':
        case 'receiving':
          activeJobs++
          break
        case 'completed':
          completedJobs++
          break
        case 'failed':
          failedJobs++
          break
      }
    }

    return {
      totalJobs: jobDataKeys.length,
      activeJobs,
      completedJobs,
      failedJobs,
      totalChunks: chunkKeys.length,
    }
  } catch (error) {
    logger.error('Failed to get job stats', { error })
    return {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalChunks: 0,
    }
  }
}

/**
 * Job details interface for health dashboard
 */
export interface JobDetails {
  jobId: string
  status: string
  total: number
  processed: number
  failed: number
  failedCount: number
  createdAt: number | null
  completedAt: number | null
  userUUID: string | null
  error: string | null
}

/**
 * Get detailed list of import jobs
 */
export async function getImportJobsList(limit = 50): Promise<JobDetails[]> {
  const redis = getRedis()

  try {
    // Use SCAN instead of KEYS for production safety
    const jobKeys = await scanKeys('import:*')
    const jobDataKeys = jobKeys.filter(
      (key) => !key.includes(':chunk:') && !key.includes(':failures')
    )

    const jobs: JobDetails[] = []

    for (const jobKey of jobDataKeys.slice(0, limit)) {
      const jobData = await redis.hgetall(jobKey)
      const jobId = jobKey.replace('import:', '')

      // Get failure count
      const failureCount = await redis.llen(`import:${jobId}:failures`)

      jobs.push({
        jobId,
        status: jobData.status || 'unknown',
        total: parseInt(jobData.total || '0'),
        processed: parseInt(jobData.processed || '0'),
        failed: parseInt(jobData.failed || '0'),
        failedCount: failureCount,
        createdAt: jobData.createdAt ? parseInt(jobData.createdAt) : null,
        completedAt: jobData.completedAt ? parseInt(jobData.completedAt) : null,
        userUUID: jobData.userUUID || null,
        error: jobData.error || null,
      })
    }

    // Sort by createdAt descending (newest first)
    jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    return jobs
  } catch (error) {
    logger.error('Failed to get jobs list', { error })
    return []
  }
}

/**
 * Failure record interface
 */
export interface FailureRecord {
  batchNumber: number
  index: number
  object: Record<string, unknown>
  error: string
  errorType: string
  timestamp: number
}

/**
 * Get failure details for a specific job
 */
export async function getJobFailures(
  jobId: string,
  offset = 0,
  limit = 100
): Promise<{ failures: FailureRecord[]; total: number }> {
  const redis = getRedis()

  try {
    const failureKey = `import:${jobId}:failures`
    const total = await redis.llen(failureKey)
    const failureStrings = await redis.lrange(
      failureKey,
      offset,
      offset + limit - 1
    )

    const failures: FailureRecord[] = failureStrings.map((str) => {
      try {
        return JSON.parse(str) as FailureRecord
      } catch {
        return {
          batchNumber: 0,
          index: 0,
          object: {},
          error: 'Failed to parse failure record',
          errorType: 'PARSE_ERROR',
          timestamp: Date.now(),
        }
      }
    })

    return { failures, total }
  } catch (error) {
    logger.error('Failed to get job failures', { error })
    return { failures: [], total: 0 }
  }
}

/**
 * Get failed objects for retry (returns the original objects)
 */
export async function getFailedObjectsForRetry(jobId: string): Promise<{
  objects: Record<string, unknown>[]
  userUUID: string | null
}> {
  const redis = getRedis()

  try {
    // Get job info for userUUID
    const jobData = await redis.hgetall(`import:${jobId}`)
    const userUUID = jobData.userUUID || null

    // Get all failures
    const failureKey = `import:${jobId}:failures`
    const failureStrings = await redis.lrange(failureKey, 0, -1)

    const objects: Record<string, unknown>[] = []
    for (const str of failureStrings) {
      try {
        const failure = JSON.parse(str) as FailureRecord
        if (failure.object) {
          objects.push(failure.object)
        }
      } catch {
        // Skip unparseable records
      }
    }

    return { objects, userUUID }
  } catch (error) {
    logger.error('Failed to get failed objects', { error })
    return { objects: [], userUUID: null }
  }
}
