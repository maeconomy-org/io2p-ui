import { NextResponse } from 'next/server'
import crypto from 'crypto'

import { getRedis } from '@/lib/redis'
import { hsetWithTTL } from '@/lib/redis-utils'
import {
  validateRequestBasics,
  validateImportPayload,
  checkImportRateLimit,
  checkConcurrentJobLimit,
  trackUserJob,
  getClientIdentifier,
} from '@/lib/security-utils'
import { logger } from '@/lib/logger'
import { API_CHUNK_SIZE } from '@/constants'
import { processImportJob } from '@/lib/import-processor'

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

    // Parse request body to get user UUID and data
    const body = await req.json()
    const { aggregateEntityList, user } = body

    if (!user?.userUUID) {
      return NextResponse.json(
        { error: 'User UUID is required in payload' },
        { status: 400 }
      )
    }

    const userUUID = user.userUUID
    const clientId = getClientIdentifier(req)

    // Validate aggregateEntityList format
    if (!aggregateEntityList || !Array.isArray(aggregateEntityList)) {
      logger.security('invalid_payload_format', {})
      return NextResponse.json(
        { error: 'Invalid data format: aggregateEntityList must be an array' },
        { status: 400 }
      )
    }

    if (aggregateEntityList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data: aggregateEntityList cannot be empty' },
        { status: 400 }
      )
    }

    // Validate payload size and object count
    const payloadValidation = validateImportPayload(aggregateEntityList)
    if (!payloadValidation.valid) {
      return NextResponse.json(
        {
          error: payloadValidation.error,
          details: {
            sizeMB: payloadValidation.size,
            objectCount: payloadValidation.objectCount,
          },
        },
        { status: 413 }
      )
    }

    // Check rate limiting (soft warning approach)
    const rateLimitCheck = await checkImportRateLimit(clientId, userUUID)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: rateLimitCheck.error,
          rateLimitInfo: rateLimitCheck.rateLimitInfo,
        },
        { status: 429 }
      )
    }

    // Check concurrent job limits
    const jobLimitCheck = await checkConcurrentJobLimit(userUUID)
    if (!jobLimitCheck.allowed) {
      return NextResponse.json({ error: jobLimitCheck.error }, { status: 429 })
    }

    // Generate a unique job ID
    const jobId = crypto.randomUUID()
    const redis = getRedis()

    // Create initial job record with TTL
    await hsetWithTTL(`import:${jobId}`, {
      status: 'receiving',
      userUUID: userUUID,
      clientId: clientId,
      createdAt: Date.now().toString(),
      payloadSizeMB: payloadValidation.size?.toFixed(2) || '0',
      objectCount: payloadValidation.objectCount?.toString() || '0',
    })

    // Track this job for the user
    await trackUserJob(userUUID, jobId)

    const objects = aggregateEntityList

    // Update job metadata with TTL
    await hsetWithTTL(`import:${jobId}`, {
      status: 'pending',
      total: objects.length,
      processed: 0,
      failed: 0,
    })

    // Store objects in chunks to avoid memory issues with TTL
    const totalChunks = Math.ceil(objects.length / API_CHUNK_SIZE)

    for (let i = 0; i < objects.length; i += API_CHUNK_SIZE) {
      const chunk = objects.slice(i, i + API_CHUNK_SIZE)
      const chunkKey = `import:${jobId}:chunk:${Math.floor(i / API_CHUNK_SIZE)}`
      await redis.setex(
        chunkKey,
        6 * 3600, // 6 hours TTL for chunks
        JSON.stringify(chunk)
      )
    }

    // Save total chunks information with TTL
    await hsetWithTTL(`import:${jobId}`, {
      totalChunks: totalChunks.toString(),
    })

    // Import started successfully - no logging needed

    // Start background processing
    startProcessing(jobId)

    // Include warnings in response if any
    const response: any = {
      jobId,
      status: 'started',
      message: 'Import job started successfully',
      totalObjects: objects.length,
    }

    if (rateLimitCheck.warning) {
      response.warning = rateLimitCheck.warning
      response.rateLimitInfo = rateLimitCheck.rateLimitInfo
    }

    if (jobLimitCheck.warning) {
      response.jobLimitWarning = jobLimitCheck.warning
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.import('Import API failed', {}, 'error')
    return NextResponse.json(
      { error: 'Failed to start import job' },
      { status: 500 }
    )
  }
}
// Function to start processing in the background
async function startProcessing(jobId: string) {
  const redis = getRedis()

  // Update job status to processing
  await redis.hset(`import:${jobId}`, { status: 'processing' })

  // Process the job in the background
  // We're using setImmediate to make it non-blocking
  setImmediate(() => {
    processImportJob(jobId).catch((error) => {
      logger.import('Background job failed', { jobId }, 'error')
      // Update job status to failed
      redis
        .hset(`import:${jobId}`, {
          status: 'failed',
          error: error.message,
        })
        .catch(() =>
          logger.import('Job status update failed', { jobId }, 'error')
        )
    })
  })
}
