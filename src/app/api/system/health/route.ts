import { NextRequest, NextResponse } from 'next/server'
import {
  getRedisMemoryInfo,
  getImportJobStats,
  cleanupExpiredJobs,
} from '@/lib/redis-utils'
import { logger } from '@/lib/logger'
import { validateInternalAccess } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  // Validate access to health endpoint
  if (!validateInternalAccess(req)) {
    logger.security('unauthorized_health_access', {
      ip:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(
      { error: 'Unauthorized access to health endpoint' },
      { status: 403 }
    )
  }

  try {
    // Get Redis memory information
    const memoryInfo = await getRedisMemoryInfo()

    // Get import job statistics
    const jobStats = await getImportJobStats()

    // Check if memory usage is high
    const memoryWarning = memoryInfo.usedMemoryPercentage > 80
    const memoryAlert = memoryInfo.usedMemoryPercentage > 95

    // Log high memory usage
    if (memoryAlert) {
      logger.security(
        'redis_memory_critical',
        {
          usedMemoryPercentage: memoryInfo.usedMemoryPercentage,
          usedMemoryMB: Math.round(memoryInfo.usedMemory / (1024 * 1024)),
          keyCount: memoryInfo.keyCount,
        },
        'error'
      )
    } else if (memoryWarning) {
      logger.security('redis_memory_warning', {
        usedMemoryPercentage: memoryInfo.usedMemoryPercentage,
        usedMemoryMB: Math.round(memoryInfo.usedMemory / (1024 * 1024)),
        keyCount: memoryInfo.keyCount,
      })
    }

    const healthData = {
      status: memoryAlert ? 'critical' : memoryWarning ? 'warning' : 'healthy',
      timestamp: new Date().toISOString(),
      redis: {
        memory: {
          usedMB: Math.round(memoryInfo.usedMemory / (1024 * 1024)),
          maxMB: Math.round(memoryInfo.maxMemory / (1024 * 1024)),
          usedPercentage:
            Math.round(memoryInfo.usedMemoryPercentage * 100) / 100,
          warning: memoryWarning,
          alert: memoryAlert,
        },
        keyCount: memoryInfo.keyCount,
      },
      imports: {
        total: jobStats.totalJobs,
        active: jobStats.activeJobs,
        completed: jobStats.completedJobs,
        failed: jobStats.failedJobs,
        chunks: jobStats.totalChunks,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        verifyCertificates: process.env.VERIFY_CERTIFICATES === 'true',
        allowInsecureFallback: process.env.ALLOW_INSECURE_FALLBACK !== 'false',
      },
    }

    return NextResponse.json(healthData)
  } catch (error) {
    logger.error('health_check_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  // Validate access to cleanup endpoint
  if (!validateInternalAccess(req)) {
    logger.security('unauthorized_cleanup_access', {
      ip:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(
      { error: 'Unauthorized access to cleanup endpoint' },
      { status: 403 }
    )
  }

  try {
    // Trigger cleanup of expired jobs
    const cleanupResult = await cleanupExpiredJobs()

    logger.info('manual_cleanup_triggered', {
      jobsDeleted: cleanupResult.jobsDeleted,
      chunksDeleted: cleanupResult.chunksDeleted,
    })

    return NextResponse.json({
      status: 'success',
      message: 'Cleanup completed',
      result: cleanupResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('manual_cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        status: 'error',
        error: 'Cleanup failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
