import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import { getRedis } from '@/lib/redis'
import { hsetWithTTL } from '@/lib/redis-utils'
import { getFailedObjectsForRetry } from '@/lib/redis-utils'
import { validateInternalAccess } from '@/lib/auth-utils'
import { logger } from '@/lib/logger'
import { API_CHUNK_SIZE } from '@/constants'
import { processImportJob } from '@/lib/import-processor'

export async function POST(req: NextRequest) {
  // Validate admin access
  if (!validateInternalAccess(req)) {
    logger.security('unauthorized_retry_access', {
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(
      { error: 'Unauthorized access to retry endpoint' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    // Get failed objects from the original job
    const { objects, userUUID } = await getFailedObjectsForRetry(jobId)

    if (objects.length === 0) {
      return NextResponse.json(
        { error: 'No failed objects found for this job' },
        { status: 404 }
      )
    }

    if (!userUUID) {
      return NextResponse.json(
        { error: 'Could not determine user UUID from original job' },
        { status: 400 }
      )
    }

    // Create a new job for the retry
    const newJobId = crypto.randomUUID()
    const redis = getRedis()

    // Calculate chunks
    const totalChunks = Math.ceil(objects.length / API_CHUNK_SIZE)

    // Store job metadata
    await hsetWithTTL(`import:${newJobId}`, {
      status: 'pending',
      total: objects.length.toString(),
      processed: '0',
      failed: '0',
      createdAt: Date.now().toString(),
      userUUID,
      retryOf: jobId,
      totalChunks: totalChunks.toString(),
      receivedChunks: totalChunks.toString(),
    })

    // Store objects in chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * API_CHUNK_SIZE
      const chunkEnd = Math.min(chunkStart + API_CHUNK_SIZE, objects.length)
      const chunk = objects.slice(chunkStart, chunkEnd)

      await redis.set(
        `import:${newJobId}:chunk:${i}`,
        JSON.stringify(chunk),
        'EX',
        6 * 60 * 60 // 6 hours TTL for chunks
      )
    }

    // Start processing in background
    processImportJob(newJobId).catch((error: unknown) => {
      logger.error('retry_job_failed', {
        jobId: newJobId,
        originalJobId: jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    })

    logger.info('retry_job_created', {
      newJobId,
      originalJobId: jobId,
      objectCount: objects.length,
      userUUID,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Retry job created',
      newJobId,
      originalJobId: jobId,
      objectCount: objects.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('retry_endpoint_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to create retry job',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
