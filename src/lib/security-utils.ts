import { getRedis } from './redis'
import {
  MAX_IMPORT_PAYLOAD_MB,
  MAX_OBJECTS_PER_IMPORT,
  MAX_CONCURRENT_JOBS_PER_USER,
  RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WARNING_THRESHOLD,
} from '@/constants'

export interface SecurityValidationResult {
  allowed: boolean
  warning?: string
  error?: string
  rateLimitInfo?: {
    current: number
    max: number
    windowMinutes: number
    resetTime: number
  }
}

export interface PayloadValidationResult {
  valid: boolean
  error?: string
  size?: number
  objectCount?: number
}

/**
 * Log security events using the unified logger
 */
import { logger } from './logger'

export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  level: 'info' | 'warn' | 'error' = 'warn'
) {
  // Use unified logger instead of direct Sentry calls
  logger.security(event, details, level)
}

/**
 * Validate import payload size and object count
 */
export function validateImportPayload(
  aggregateEntityList: any[],
  requestSize?: number
): PayloadValidationResult {
  const objectCount = aggregateEntityList.length
  const estimatedSize =
    requestSize || JSON.stringify(aggregateEntityList).length
  const sizeMB = estimatedSize / (1024 * 1024)

  // Check payload size
  if (sizeMB > MAX_IMPORT_PAYLOAD_MB) {
    logSecurityEvent('payload_size_exceeded', {
      sizeMB: sizeMB.toFixed(2),
      maxSizeMB: MAX_IMPORT_PAYLOAD_MB,
    })
    return {
      valid: false,
      error: `Payload size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${MAX_IMPORT_PAYLOAD_MB}MB)`,
      size: sizeMB,
      objectCount,
    }
  }

  // Check object count
  if (objectCount > MAX_OBJECTS_PER_IMPORT) {
    logSecurityEvent('object_count_exceeded', {
      maxObjects: MAX_OBJECTS_PER_IMPORT,
    })
    return {
      valid: false,
      error: `Object count (${objectCount}) exceeds maximum allowed objects (${MAX_OBJECTS_PER_IMPORT})`,
      size: sizeMB,
      objectCount,
    }
  }

  // Log large imports for monitoring
  if (sizeMB > 50 || objectCount > 10000) {
    logSecurityEvent('large_import_detected', {}, 'info')
  }

  return {
    valid: true,
    size: sizeMB,
    objectCount,
  }
}

/**
 * Check rate limiting for import operations
 * Returns soft warnings instead of hard blocks
 */
export async function checkImportRateLimit(
  identifier: string, // Could be IP, userUUID, or session ID
  userUUID?: string
): Promise<SecurityValidationResult> {
  const redis = getRedis()
  const rateLimitKey = `rate_limit:import:${identifier}`
  const windowSeconds = RATE_LIMIT_WINDOW_MINUTES * 60

  try {
    // Get current count and increment
    const pipeline = redis.pipeline()
    pipeline.incr(rateLimitKey)
    pipeline.expire(rateLimitKey, windowSeconds)
    pipeline.ttl(rateLimitKey)

    const results = await pipeline.exec()
    const currentCount = results?.[0]?.[1] as number
    const ttl = results?.[2]?.[1] as number

    const resetTime = Date.now() + ttl * 1000

    const rateLimitInfo = {
      current: currentCount,
      max: RATE_LIMIT_MAX_REQUESTS,
      windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
      resetTime,
    }

    // Hard limit exceeded - return error
    if (currentCount > RATE_LIMIT_MAX_REQUESTS) {
      logSecurityEvent('rate_limit_exceeded', {
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
        windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
      })

      return {
        allowed: false,
        error: `Rate limit exceeded. Please wait ${Math.ceil(ttl / 60)} minutes before trying again.`,
        rateLimitInfo,
      }
    }

    // Warning threshold reached - return warning but allow
    if (currentCount >= RATE_LIMIT_WARNING_THRESHOLD) {
      logSecurityEvent('rate_limit_warning', {
        warningThreshold: RATE_LIMIT_WARNING_THRESHOLD,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
      })

      return {
        allowed: true,
        warning: `You are approaching the rate limit (${currentCount}/${RATE_LIMIT_MAX_REQUESTS} requests). Please slow down to avoid being temporarily blocked.`,
        rateLimitInfo,
      }
    }

    return {
      allowed: true,
      rateLimitInfo,
    }
  } catch (error) {
    // If Redis fails, log error but allow the request
    logSecurityEvent(
      'rate_limit_check_failed',
      {
        identifier,
        userUUID,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    )

    return {
      allowed: true,
      warning: 'Rate limiting temporarily unavailable',
    }
  }
}

/**
 * Check concurrent job limits for a user
 */
export async function checkConcurrentJobLimit(
  userUUID: string
): Promise<SecurityValidationResult> {
  const redis = getRedis()
  const userJobsKey = `user_jobs:${userUUID}`

  try {
    const currentJobCount = await redis.scard(userJobsKey)

    if (currentJobCount >= MAX_CONCURRENT_JOBS_PER_USER) {
      logSecurityEvent('concurrent_job_limit_exceeded', {
        userUUID,
        currentJobs: currentJobCount,
        maxJobs: MAX_CONCURRENT_JOBS_PER_USER,
      })

      return {
        allowed: false,
        error: `Maximum concurrent imports (${MAX_CONCURRENT_JOBS_PER_USER}) reached. Please wait for existing imports to complete.`,
      }
    }

    // Warning at 80% of limit
    const warningThreshold = Math.floor(MAX_CONCURRENT_JOBS_PER_USER * 0.8)
    if (currentJobCount >= warningThreshold) {
      return {
        allowed: true,
        warning: `You have ${currentJobCount} active imports. Consider waiting for some to complete before starting new ones.`,
      }
    }

    return { allowed: true }
  } catch (error) {
    logSecurityEvent(
      'concurrent_job_check_failed',
      {
        userUUID,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    )

    return {
      allowed: true,
      warning: 'Job limit checking temporarily unavailable',
    }
  }
}

/**
 * Track a new job for a user
 */
export async function trackUserJob(
  userUUID: string,
  jobId: string
): Promise<void> {
  const redis = getRedis()
  const userJobsKey = `user_jobs:${userUUID}`

  try {
    await redis.sadd(userJobsKey, jobId)
    await redis.expire(userJobsKey, 86400) // 24 hours
  } catch (error) {
    logSecurityEvent(
      'job_tracking_failed',
      {
        userUUID,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    )
  }
}

/**
 * Remove a completed job from user tracking
 */
export async function untrackUserJob(
  userUUID: string,
  jobId: string
): Promise<void> {
  const redis = getRedis()
  const userJobsKey = `user_jobs:${userUUID}`

  try {
    await redis.srem(userJobsKey, jobId)
  } catch (error) {
    logSecurityEvent(
      'job_untracking_failed',
      {
        userUUID,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    )
  }
}

/**
 * Get client identifier for rate limiting (IP or session-based)
 */
export function getClientIdentifier(req: Request): string {
  // GDPR compliant - don't store actual IPs, use hash for rate limiting
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent') || ''

  const clientIP = forwardedFor?.split(',')[0] || realIP

  if (clientIP && clientIP !== 'unknown') {
    // Create a hash for rate limiting without storing actual IP
    const crypto = require('crypto')
    return crypto
      .createHash('sha256')
      .update(clientIP + userAgent)
      .digest('hex')
      .substring(0, 16)
  }

  return 'anonymous'
}

/**
 * Validate request content type and size
 */
export function validateRequestBasics(req: Request): {
  valid: boolean
  error?: string
} {
  const contentType = req.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return {
      valid: false,
      error: 'Content type must be application/json',
    }
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024)
    if (sizeMB > MAX_IMPORT_PAYLOAD_MB) {
      return {
        valid: false,
        error: `Request size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${MAX_IMPORT_PAYLOAD_MB}MB)`,
      }
    }
  }

  return { valid: true }
}
