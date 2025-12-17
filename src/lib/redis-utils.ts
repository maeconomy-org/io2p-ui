import { getRedis } from './redis'
import { REDIS_JOB_TTL_HOURS, REDIS_CHUNK_TTL_HOURS } from '@/constants'

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
    console.error('Failed to get Redis memory info:', error)
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
    // Find all import job keys
    const jobKeys = await redis.keys('import:*')
    let jobsDeleted = 0
    let chunksDeleted = 0

    for (const jobKey of jobKeys) {
      // Skip chunk keys, we'll handle them separately
      if (jobKey.includes(':chunk:')) continue

      // Check if job is old enough to clean up
      const jobData = await redis.hgetall(jobKey)
      if (!jobData.createdAt) continue

      const createdAt = parseInt(jobData.createdAt)
      const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60)

      // Clean up jobs older than TTL + 1 hour buffer
      if (ageHours > REDIS_JOB_TTL_HOURS + 1) {
        // Find and delete associated chunks
        const jobId = jobKey.replace('import:', '')
        const chunkKeys = await redis.keys(`import:${jobId}:chunk:*`)

        if (chunkKeys.length > 0) {
          await redis.del(...chunkKeys)
          chunksDeleted += chunkKeys.length
        }

        // Delete job data
        await redis.del(jobKey)
        jobsDeleted++
      }
    }

    return { jobsDeleted, chunksDeleted }
  } catch (error) {
    console.error('Failed to cleanup expired jobs:', error)
    return { jobsDeleted: 0, chunksDeleted: 0 }
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
    const jobKeys = await redis.keys('import:*')
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
    console.error('Failed to get job stats:', error)
    return {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalChunks: 0,
    }
  }
}
