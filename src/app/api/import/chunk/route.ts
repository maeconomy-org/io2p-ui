import crypto from 'crypto'
import { NextResponse } from 'next/server'

import { getRedis } from '@/lib/redis'

// Handle initial chunk upload and session start
export async function POST(req: Request) {
  try {
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
    const chunk = aggregateEntityList

    if (!Array.isArray(chunk) || chunk.length === 0) {
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

    // Generate or use session ID
    const jobId = sessionId || crypto.randomUUID()
    const redis = getRedis()

    // If this is the first chunk, initialize the job
    if (chunkIndex === 0 && !sessionId) {
      await redis.hset(`import:${jobId}`, {
        status: 'receiving',
        userUUID: userUUID,
        total: total.toString(),
        processed: '0',
        failed: '0',
        receivedChunks: '0',
        totalChunks: totalChunks.toString(),
        createdAt: Date.now().toString(),
      })
    }

    // Save this chunk
    await redis.set(
      `import:${jobId}:chunk:${chunkIndex}`,
      JSON.stringify(chunk)
    )

    // Update received chunks count
    const receivedChunks = await redis.hincrby(
      `import:${jobId}`,
      'receivedChunks',
      1
    )

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
    console.error('Chunk upload error:', error)
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
      const { processImportJob } = await import('../process')

      // Update job status to processing
      await redis.hset(`import:${jobId}`, { status: 'processing' })

      // Process the job
      await processImportJob(jobId)
    } catch (error) {
      console.error(`Error processing import job ${jobId}:`, error)
      // Update job status to failed
      redis
        .hset(`import:${jobId}`, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .catch(console.error)
    }
  })
}
