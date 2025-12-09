// Shared Sentry configuration for all runtimes (server, edge, client)
// This reduces duplication across sentry.*.config.ts files

import type { ErrorEvent } from '@sentry/nextjs'

// Type alias for Sentry event (not DOM Event)
type SentryEvent = ErrorEvent

/**
 * Common Sentry options shared across all runtimes
 */
export const sharedSentryOptions = {
  // Disable performance tracing - we only need error monitoring
  tracesSampleRate: 0,

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
 * Console logging levels to capture
 */
export const consoleLevels = ['error', 'warn', 'log'] as const

/**
 * GDPR-compliant data scrubbing for beforeSend hook
 * Removes IP addresses, emails, and sensitive headers
 */
export function scrubSensitiveData(event: SentryEvent): SentryEvent | null {
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
 * Combined beforeSend hook for all runtimes
 */
export function beforeSend(event: SentryEvent): SentryEvent | null {
  // First scrub sensitive data
  const scrubbedEvent = scrubSensitiveData(event)
  if (!scrubbedEvent) return null

  // Then filter noisy errors
  return filterNoisyErrors(scrubbedEvent)
}
