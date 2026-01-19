import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

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
import { processImportJob } from '@/lib/import-processor'

/**
 * Chunked import API route - handles large datasets in chunks
 * Uses JWT token for authentication (passed in Authorization header)
 */
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

    // Extract JWT token from Authorization header
    const headersList = await headers()
    const authorization = headersList.get('authorization')

    if (!authorization || !authorization.startsWith('Bearer ')) {
      logger.security('missing_jwt_token_chunk', {
        clientId: getClientIdentifier(req),
      })
      return NextResponse.json(
        { error: 'Authorization header with JWT token is required' },
        { status: 401 }
      )
    }

    const jwtToken = authorization.substring(7) // Remove 'Bearer ' prefix

    // Parse the request body
    const body = await req.json()
    const { aggregateEntityList, total, chunkIndex, totalChunks, sessionId } =
      body // No user object needed - JWT contains user info

    const clientId = getClientIdentifier(req)
    const chunk = aggregateEntityList

    if (!Array.isArray(chunk) || chunk.length === 0) {
      logSecurityEvent('invalid_chunk_format', {
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
          details: {
            sizeMB: chunkValidation.size,
            objectCount: chunkValidation.objectCount,
          },
        },
        { status: 413 }
      )
    }

    // For rate limiting, we'll use a placeholder userUUID from JWT
    // In a real implementation, you'd decode the JWT to get the actual userUUID
    const userUUID = 'jwt-user' // TODO: Decode JWT to get actual userUUID

    // Check rate limiting (applies to overall session)
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

    let currentJobId = sessionId

    // For the first chunk, create a new job ID and initialize job metadata
    if (chunkIndex === 0) {
      currentJobId = crypto.randomUUID()
      const redis = getRedis()

      await hsetWithTTL(`import:${currentJobId}`, {
        status: 'receiving',
        userUUID: userUUID,
        clientId: clientId,
        jwtToken: jwtToken, // Store JWT token for API calls
        createdAt: Date.now().toString(),
        total: total.toString(),
        totalChunks: totalChunks.toString(),
        payloadSizeMB: chunkValidation.size?.toFixed(2) || '0',
        objectCount: chunkValidation.objectCount?.toString() || '0',
      })

      // Store the first chunk
      await setWithTTL(
        `import:${currentJobId}:chunk:0`,
        JSON.stringify(chunk),
        6 * 3600 // 6 hours TTL for chunks
      )
    } else if (currentJobId) {
      // For subsequent chunks, store them
      const redis = getRedis()
      await setWithTTL(
        `import:${currentJobId}:chunk:${chunkIndex}`,
        JSON.stringify(chunk),
        6 * 3600 // 6 hours TTL for chunks
      )
    } else {
      logSecurityEvent('missing_session_id_for_chunk', {
        clientId,
        chunkIndex,
      })
      return NextResponse.json(
        { error: 'Session ID is required for subsequent chunks' },
        { status: 400 }
      )
    }

    // If this is the last chunk, trigger background processing
    if (chunkIndex === totalChunks - 1 && currentJobId) {
      const redis = getRedis()
      await redis.hset(`import:${currentJobId}`, { status: 'pending' })
      startProcessing(currentJobId)
    }

    return NextResponse.json({
      jobId: currentJobId,
      status: 'chunk_received',
      chunkIndex,
      totalChunks,
    })
  } catch (error: any) {
    logger.import('Chunk import API failed', { error: error.message }, 'error')
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
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
  setImmediate(() => {
    processImportJob(jobId).catch((error) => {
      logger.import(
        'Background job failed',
        { jobId, error: error.message },
        'error'
      )
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
