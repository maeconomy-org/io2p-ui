import crypto from 'crypto'
import { NextResponse } from 'next/server'

import { getRedis } from '@/lib/redis'
import { hsetWithTTL, setWithTTL } from '@/lib/redis-utils'
import {
  validateRequestBasics,
  validateImportPayload,
  checkImportRateLimit,
  getClientIdentifier,
  logSecurityEvent,
} from '@/lib/security-utils'
import { logger } from '@/lib/logger'

// Handle initial chunk upload and session start
export async function POST(req: Request) {
  try {
    // Validate basic request properties
    const basicValidation = validateRequestBasics(req)
    if (!basicValidation.valid) {
      return NextResponse.json(
        { error: basicValidation.error },
        { status: 400 }
      )
    }

    // Parse the request body with new structure
    const body = await req.json()
    const {
      aggregateEntityList,
      user,
      total,
      chunkIndex,
      totalChunks,
      sessionId,
    } = body

    // Validate user UUID in payload
    if (!user?.userUUID) {
      return NextResponse.json(
        { error: 'User UUID is required in payload' },
        { status: 400 }
      )
    }

    const userUUID = user.userUUID
    const clientId = getClientIdentifier(req)
    const chunk = aggregateEntityList

    if (!Array.isArray(chunk) || chunk.length === 0) {
      logSecurityEvent('invalid_chunk_format', {
        userUUID,
        clientId,
        chunkIndex,
      })
      return NextResponse.json(
        {
          error: 'Invalid chunk: aggregateEntityList must be a non-empty array',
        },
        { status: 400 }
      )
    }

    if (
      typeof total !== 'number' ||
      typeof chunkIndex !== 'number' ||
      typeof totalChunks !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing required numeric parameters' },
        { status: 400 }
      )
    }

    // Validate chunk payload
    const chunkValidation = validateImportPayload(chunk)
    if (!chunkValidation.valid) {
      return NextResponse.json(
        {
          error: chunkValidation.error,
          chunkIndex,
          details: {
            sizeMB: chunkValidation.size,
            objectCount: chunkValidation.objectCount,
          },
        },
        { status: 413 }
      )
    }

    // Check rate limiting for chunk uploads (more lenient than full imports)
    const rateLimitCheck = await checkImportRateLimit(
      `chunk:${clientId}`,
      userUUID
    )
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: rateLimitCheck.error,
          chunkIndex,
          rateLimitInfo: rateLimitCheck.rateLimitInfo,
        },
        { status: 429 }
      )
    }

    // Generate or use session ID
    const jobId = sessionId || crypto.randomUUID()
    const redis = getRedis()

    // If this is the first chunk, initialize the job
    if (chunkIndex === 0 && !sessionId) {
      await hsetWithTTL(`import:${jobId}`, {
        status: 'receiving',
        userUUID: userUUID,
        clientId: clientId,
        total: total.toString(),
        processed: '0',
        failed: '0',
        receivedChunks: '0',
        totalChunks: totalChunks.toString(),
        createdAt: Date.now().toString(),
        chunkSizeMB: chunkValidation.size?.toFixed(2) || '0',
      })

      // Log chunk upload start
      logSecurityEvent(
        'chunked_import_started',
        {
          jobId,
          userUUID,
          totalObjects: total,
          totalChunks,
          estimatedSizeMB: (chunkValidation.size || 0) * totalChunks,
        },
        'info'
      )
    }

    // Save this chunk with TTL
    await setWithTTL(
      `import:${jobId}:chunk:${chunkIndex}`,
      JSON.stringify(chunk)
    )

    // Update received chunks count
    const receivedChunks = await redis.hincrby(
      `import:${jobId}`,
      'receivedChunks',
      1
    )

    // Log chunk progress
    if (chunkIndex % 10 === 0 || chunkIndex === totalChunks - 1) {
      logSecurityEvent(
        'chunk_upload_progress',
        {
          jobId,
          userUUID,
          chunkIndex,
          totalChunks,
          receivedChunks,
          progress: Math.round((receivedChunks / totalChunks) * 100),
        },
        'info'
      )
    }

    // Check if all chunks are received
    if (parseInt(receivedChunks.toString()) === totalChunks) {
      await redis.hset(`import:${jobId}`, {
        status: 'pending',
      })

      // Start processing (non-blocking)
      startProcessing(jobId)
    }

    return NextResponse.json({
      jobId,
      status: 'chunk_received',
      message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
      progress: `${receivedChunks}/${totalChunks} chunks`,
      complete: parseInt(receivedChunks.toString()) === totalChunks,
    })
  } catch (error) {
    logger.error('Chunk upload error', { error })
    return NextResponse.json(
      { error: 'Failed to process chunk' },
      { status: 500 }
    )
  }
}

// Function to start processing in the background
async function startProcessing(jobId: string) {
  const redis = getRedis()

  // Set immediate to make it non-blocking
  setImmediate(async () => {
    try {
      // Import dynamically to avoid circular dependencies
      const { processImportJob } = await import('@/lib/import-processor')

      // Update job status to processing
      await redis.hset(`import:${jobId}`, { status: 'processing' })

      // Process the job
      await processImportJob(jobId)
    } catch (error) {
      logger.error('Error processing import job', { jobId, error })
      // Update job status to failed
      redis
        .hset(`import:${jobId}`, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .catch((err) =>
          logger.error('Failed to update job status', { jobId, error: err })
        )
    }
  })
}
