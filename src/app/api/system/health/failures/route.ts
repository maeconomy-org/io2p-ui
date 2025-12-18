import { NextRequest, NextResponse } from 'next/server'

import { getJobFailures } from '@/lib/redis-utils'
import { validateInternalAccess } from '@/lib/auth-utils'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  // Validate admin access
  if (!validateInternalAccess(req)) {
    logger.security('unauthorized_failures_access', {
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(
      { error: 'Unauthorized access to failures endpoint' },
      { status: 403 }
    )
  }

  try {
    const url = new URL(req.url)
    const jobId = url.searchParams.get('jobId')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const { failures, total } = await getJobFailures(jobId, offset, limit)

    return NextResponse.json({
      jobId,
      failures,
      total,
      offset,
      limit,
      hasMore: offset + failures.length < total,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('failures_endpoint_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to get failures',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
