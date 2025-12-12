// app/api/import/route.ts
import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import crypto from 'crypto'
import { processImportJob } from './process'

export const config = {
  api: {
    bodyParser: false, // Disable the built-in body parser
    responseLimit: false, // No response limit
  },
}

export async function POST(req: Request) {
  try {
    // Use a streaming approach for large payloads
    const contentType = req.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content type must be application/json' },
        { status: 400 }
      )
    }

    // Generate a unique job ID early
    const jobId = crypto.randomUUID()
    const redis = getRedis()

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

    // Create initial job record
    await redis.hset(`import:${jobId}`, {
      status: 'receiving',
      userUUID: userUUID,
      createdAt: Date.now().toString(),
    })

    // Validate aggregateEntityList
    if (!aggregateEntityList || !Array.isArray(aggregateEntityList)) {
      await redis.hset(`import:${jobId}`, {
        status: 'failed',
        error: 'Invalid data format: aggregateEntityList must be an array',
      })
      return NextResponse.json(
        { error: 'Invalid data format: aggregateEntityList must be an array' },
        { status: 400 }
      )
    }

    if (aggregateEntityList.length === 0) {
      await redis.hset(`import:${jobId}`, {
        status: 'failed',
        error: 'Invalid data: aggregateEntityList cannot be empty',
      })
      return NextResponse.json(
        { error: 'Invalid data: aggregateEntityList cannot be empty' },
        { status: 400 }
      )
    }

    const objects = aggregateEntityList

    // Update job metadata
    await redis.hset(`import:${jobId}`, {
      status: 'pending',
      total: objects.length,
      processed: 0,
      failed: 0,
    })

    // Store objects in chunks to avoid memory issues
    // Note: Objects are stored in chunks for memory efficiency,
    // but will be processed one by one in the background process
    const CHUNK_SIZE = 100
    const totalChunks = Math.ceil(objects.length / CHUNK_SIZE)

    for (let i = 0; i < objects.length; i += CHUNK_SIZE) {
      const chunk = objects.slice(i, i + CHUNK_SIZE)
      await redis.set(
        `import:${jobId}:chunk:${Math.floor(i / CHUNK_SIZE)}`,
        JSON.stringify(chunk)
      )
    }

    // Save total chunks information
    await redis.hset(`import:${jobId}`, {
      totalChunks: totalChunks.toString(),
    })

    // Start background processing
    startProcessing(jobId)

    return NextResponse.json({
      jobId,
      status: 'started',
      message: 'Import job started successfully',
      totalObjects: objects.length,
    })
  } catch (error) {
    console.error('Import error:', error)
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
      console.error(`Error processing import job ${jobId}:`, error)
      // Update job status to failed
      redis
        .hset(`import:${jobId}`, {
          status: 'failed',
          error: error.message,
        })
        .catch(console.error)
    })
  })
}
