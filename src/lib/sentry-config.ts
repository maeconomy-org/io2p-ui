// Shared Sentry configuration for all runtimes (server, edge, client)
// This reduces duplication across sentry.*.config.ts files

import type { ErrorEvent } from '@sentry/nextjs'

// Type alias for Sentry event (not DOM Event)
type SentryEvent = ErrorEvent

/**
 * Common Sentry options shared across all runtimes
 */
export const sharedSentryOptions = {
  // Enable session health tracking (crash rates, stability metrics)
  autoSessionTracking: true,

  // Disable all default integrations to prevent auto-loading 40+ integrations
  defaultIntegrations: false,

  // Enable console log capture
  enableLogs: true,

  // NEVER enable debug - causes verbose terminal logging
  debug: false,

  // GDPR: Disable automatic PII collection
  sendDefaultPii: false,
} as const

/**
 * Smart transaction sampler for free plan optimization
 * Drops noise transactions that waste quota (health checks, config, sentry tunnel)
 */
export function tracesSampler(samplingContext: {
  name?: string
  attributes?: Record<string, unknown>
}): number {
  const name = samplingContext.name || ''

  // Drop health check and config transactions (waste of quota)
  if (name.includes('/api/config') || name.includes('/api/health')) {
    return 0
  }

  // Drop Sentry tunnel transactions
  if (name.includes('/monitoring') || name.includes('/api/sentry-tunnel')) {
    return 0
  }

  // Default: 10% sampling (free tier friendly)
  return 0.1
}

/**
 * Console logging levels to capture
 */
export const consoleLevels = ['error', 'warn', 'log'] as const

/**
 * GDPR-compliant data scrubbing for beforeSend hook
 * Removes IP addresses, emails, and sensitive headers
 */
function scrubSensitiveData(event: SentryEvent): SentryEvent | null {
  // Remove user PII for GDPR compliance
  if (event.user) {
    delete event.user.ip_address
    delete event.user.email
  }

  // Remove request headers that may contain PII (server-side only)
  if (event.request?.headers) {
    delete event.request.headers['x-forwarded-for']
    delete event.request.headers['x-real-ip']
    delete event.request.headers.cookie
    delete event.request.headers.authorization
  }

  return event
}

/**
 * Filter out noisy errors that aren't actionable
 */
export function filterNoisyErrors(event: SentryEvent): SentryEvent | null {
  const errorType = event.exception?.values?.[0]?.type || ''
  const errorMessage = event.exception?.values?.[0]?.value || ''

  // Server-side noise
  if (
    errorType === 'NetworkError' ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT')
  ) {
    return null
  }

  // Next.js Server Action errors (bot traffic and version skew)
  // These are logged but don't affect legitimate users
  if (
    errorMessage.includes('Failed to find Server Action') ||
    errorMessage.includes("Missing 'next-action' header")
  ) {
    return null
  }

  // Client-side noise
  if (
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Loading chunk') ||
    errorMessage.includes('ChunkLoadError') ||
    errorMessage.includes('ResizeObserver') ||
    errorMessage.includes('Non-Error promise rejection')
  ) {
    return null
  }

  return event
}

/**
 * Redact S3 presigned-URL credentials wherever they may appear in a Sentry
 * event. Presigned URLs are self-authenticating for their full TTL (5 min on
 * upload PUTs, 15 min on previews), so leaking the `X-Amz-Signature` /
 * `X-Amz-Credential` query string into Sentry is equivalent to leaking
 * short-lived write access to the bucket. We also redact AWS SigV4
 * `Authorization` header values in case a future direct-call code path
 * ever surfaces one in an exception message.
 */
const AMZ_QUERY_PARAMS = [
  'X-Amz-Signature',
  'X-Amz-Credential',
  'X-Amz-Security-Token',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-SignedHeaders',
  'X-Amz-Algorithm',
]

export function redactPresignedUrlString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return input
  let out = input
  // Strip X-Amz-* query params (case-insensitive).
  for (const key of AMZ_QUERY_PARAMS) {
    const pattern = new RegExp(`([?&])${key}=[^&\\s"'<>]*`, 'gi')
    out = out.replace(pattern, '$1' + key + '=REDACTED')
  }
  // Strip SigV4 Authorization values.
  out = out.replace(
    /AWS4-HMAC-SHA256\s+Credential=[^,\s]+,\s*SignedHeaders=[^,\s]+,\s*Signature=[A-Fa-f0-9]+/g,
    'AWS4-HMAC-SHA256 REDACTED'
  )
  return out
}

// Walk a plain object up to `depth` levels deep, replacing string leaves in
// place via `redactPresignedUrlString`. Cycle-safe via the `seen` set.
function redactDeep(value: unknown, depth: number, seen: WeakSet<object>) {
  if (depth <= 0 || value === null || value === undefined) return
  if (typeof value === 'object') {
    if (seen.has(value as object)) return
    seen.add(value as object)
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const v = value[i]
        if (typeof v === 'string') value[i] = redactPresignedUrlString(v)
        else redactDeep(v, depth - 1, seen)
      }
      return
    }
    const obj = value as Record<string, unknown>
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (typeof v === 'string') obj[k] = redactPresignedUrlString(v)
      else redactDeep(v, depth - 1, seen)
    }
  }
}

function scrubPresignedUrls(event: SentryEvent): SentryEvent {
  if (event.request?.url) {
    event.request.url = redactPresignedUrlString(event.request.url)
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      const data = crumb.data as Record<string, unknown> | undefined
      if (!data) continue
      for (const k of ['url', 'to', 'from']) {
        const v = data[k]
        if (typeof v === 'string') data[k] = redactPresignedUrlString(v)
      }
    }
  }
  const values = event.exception?.values
  if (Array.isArray(values)) {
    const seen = new WeakSet<object>()
    for (const v of values) {
      if (typeof v.value === 'string') {
        v.value = redactPresignedUrlString(v.value)
      }
      // Sentry attaches arbitrary structured data under mechanism.data
      // (including Error.cause snapshots); scrub it recursively.
      const mech = (v as { mechanism?: { data?: unknown } }).mechanism
      if (mech?.data) redactDeep(mech.data, 5, seen)
      // Some Sentry SDKs preserve the original Error reference here.
      const original = (v as { originalException?: unknown }).originalException
      if (original) redactDeep(original, 5, seen)
    }
  }
  if (typeof event.message === 'string') {
    event.message = redactPresignedUrlString(event.message)
  }
  // Walk any `cause` chain attached to event.extra (Sentry's catch-all).
  if (event.extra) redactDeep(event.extra, 5, new WeakSet())
  return event
}

/**
 * Combined beforeSend hook for all runtimes
 */
export function beforeSend(event: SentryEvent): SentryEvent | null {
  // First scrub sensitive data
  const scrubbedEvent = scrubSensitiveData(event)
  if (!scrubbedEvent) return null

  // Redact S3 presigned credentials before any noise filtering.
  const presignedScrubbed = scrubPresignedUrls(scrubbedEvent)

  // Then filter noisy errors
  return filterNoisyErrors(presignedScrubbed)
}
