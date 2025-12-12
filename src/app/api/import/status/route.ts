import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

export async function GET(req: Request) {
  // Get job ID from the request
  const url = new URL(req.url)
  const jobId = url.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
  }

  try {
    // Get job data from Redis
    const redis = getRedis()
    const jobData = await redis.hgetall(`import:${jobId}`)

    if (!jobData || Object.keys(jobData).length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Format the response
    const response = {
      jobId,
      status: jobData.status || 'unknown',
      total: parseInt(jobData.total || '0'),
      processed: parseInt(jobData.processed || '0'),
      failed: parseInt(jobData.failed || '0'),
      createdAt: jobData.createdAt
        ? new Date(parseInt(jobData.createdAt))
        : undefined,
      completedAt: jobData.completedAt
        ? new Date(parseInt(jobData.completedAt))
        : undefined,
      error: jobData.error,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting job status:', error)
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    )
  }
}
