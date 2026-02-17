import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { REDIS_KEYS } from '@/lib/redis-utils'

/**
 * PATCH /api/import/cancel - Cancel an import job
 *
 * This endpoint marks a job as cancelled and prevents further processing.
 * For jobs in 'receiving' status, it prevents chunks from being processed.
 * For jobs in 'processing' status, it stops processing remaining batches.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const redis = getRedis()
    const jobKey = REDIS_KEYS.job(jobId)

    // Get current job status
    const jobData = await redis.hgetall(jobKey)

    if (!jobData || Object.keys(jobData).length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const currentStatus = jobData.status

    // Only allow cancellation of active jobs
    if (!['pending', 'receiving', 'processing'].includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Cannot cancel job with status '${currentStatus}'. Only pending, receiving, or processing jobs can be cancelled.`,
        },
        { status: 400 }
      )
    }

    // Update job status to cancelled
    await redis.hset(jobKey, {
      status: 'cancelled',
      cancelledAt: Date.now().toString(),
      error: 'Job cancelled by user',
    })

    // If job is in 'receiving' status, delete all chunks to prevent processing
    if (currentStatus === 'receiving') {
      const totalChunks = parseInt(jobData.totalChunks || '0')
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = REDIS_KEYS.chunk(jobId, i)
        await redis.del(chunkKey)
      }
      logger.import(`Deleted ${totalChunks} chunks for cancelled job`, {
        jobId,
        totalChunks,
      })
    }

    logger.import(`Job cancelled`, {
      jobId,
      previousStatus: currentStatus,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId,
      previousStatus: currentStatus,
    })
  } catch (error) {
    logger.error('Error cancelling import job', { error })
    return NextResponse.json(
      { error: 'Failed to cancel import job' },
      { status: 500 }
    )
  }
}
