import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

interface JobSummary {
  jobId: string
  status: string
  total: number
  processed: number
  failed: number
  createdAt: number | null
  completedAt: number | null
  error: string | null
}

interface JobDetails extends JobSummary {
  // Additional fields for detailed view
}

/**
 * Scan Redis keys using SCAN instead of KEYS (production-safe)
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
 * GET /api/import/jobs - Unified endpoint for import jobs
 *
 * List all jobs:
 *   Query params:
 *   - userUUID: Filter by user UUID (optional)
 *   - limit: Max number of jobs to return (default: 50)
 *
 * Get specific job details:
 *   Query params:
 *   - jobId: Specific job ID to get details for
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const jobId = url.searchParams.get('jobId')
  const userUUID = url.searchParams.get('userUUID')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  try {
    const redis = getRedis()

    // If jobId is provided, return specific job details
    if (jobId) {
      const jobData = await redis.hgetall(`import:${jobId}`)

      if (!jobData || Object.keys(jobData).length === 0) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      // Format detailed job response
      const response: JobDetails = {
        jobId,
        status: jobData.status || 'unknown',
        total: parseInt(jobData.total || '0'),
        processed: parseInt(jobData.processed || '0'),
        failed: parseInt(jobData.failed || '0'),
        createdAt: jobData.createdAt ? parseInt(jobData.createdAt) : null,
        completedAt: jobData.completedAt ? parseInt(jobData.completedAt) : null,
        error: jobData.error || null,
      }

      return NextResponse.json(response)
    }

    // Otherwise, return list of all jobs
    const jobKeys = await scanKeys('import:*')
    const jobDataKeys = jobKeys.filter(
      (key) => !key.includes(':chunk:') && !key.includes(':failures')
    )

    const jobs: JobSummary[] = []

    for (const jobKey of jobDataKeys) {
      const jobData = await redis.hgetall(jobKey)
      const currentJobId = jobKey.replace('import:', '')

      // Filter by userUUID if provided
      if (userUUID && jobData.userUUID !== userUUID) {
        continue
      }

      jobs.push({
        jobId: currentJobId,
        status: jobData.status || 'unknown',
        total: parseInt(jobData.total || '0'),
        processed: parseInt(jobData.processed || '0'),
        failed: parseInt(jobData.failed || '0'),
        createdAt: jobData.createdAt ? parseInt(jobData.createdAt) : null,
        completedAt: jobData.completedAt ? parseInt(jobData.completedAt) : null,
        error: jobData.error || null,
      })

      // Stop if we've reached the limit
      if (jobs.length >= limit) {
        break
      }
    }

    // Sort by createdAt descending (newest first)
    jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    return NextResponse.json({
      jobs,
      total: jobs.length,
    })
  } catch (error) {
    logger.error('Error getting import jobs', { error })
    return NextResponse.json(
      { error: 'Failed to get import jobs' },
      { status: 500 }
    )
  }
}
