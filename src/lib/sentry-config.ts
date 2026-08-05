// Shared Sentry configuration for all runtimes (server, edge, client)
// This reduces duplication across sentry.*.config.ts files
//
// Scrubbing primitives live in `@/lib/redact` (neutral module) so the logger
// sinks share them. What stays here is Sentry-shaped: the event adapters and
// the noise filters. The ECONNREFUSED/ETIMEDOUT filter is deliberately
// Sentry-ONLY — core being down is exactly what the NDJSON/ship/OTel paths
// must record, so it must never move into redact.ts.

import type { ErrorEvent } from '@sentry/nextjs'

import { redactDeep, redactPresignedUrlString } from '@/lib/redact'

// Re-export so existing imports (tests, tooling) keep one name for it.
export { redactPresignedUrlString } from '@/lib/redact'

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
