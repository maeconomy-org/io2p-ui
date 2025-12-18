import { NextRequest, NextResponse } from 'next/server'
import { deleteJob } from '@/lib/redis-utils'
import { logger } from '@/lib/logger'
import { validateInternalAccess } from '@/lib/auth-utils'

export async function POST(req: NextRequest) {
  // Validate access
  if (!validateInternalAccess(req)) {
    logger.security('unauthorized_delete_job_access', {
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { jobId } = body

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid jobId' },
        { status: 400 }
      )
    }

    const result = await deleteJob(jobId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete job' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
      chunksDeleted: result.chunksDeleted,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('delete_job_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
