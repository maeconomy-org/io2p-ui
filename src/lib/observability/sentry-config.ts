// Sentry configuration — BROWSER ONLY, errors only (observability plan
// §1.3/§1.4). There is no server or edge Sentry init anymore: server errors
// flow via the logger (NDJSON stdout + OTel). Consumed by
// instrumentation-client.ts and the logger's Sentry sink.
//
// Scrubbing primitives live in `@/lib/redact` (neutral module) so the logger
// sinks share them. What stays here is Sentry-shaped: the event adapters and
// the noise filters. The ECONNREFUSED/ETIMEDOUT filter is deliberately
// Sentry-ONLY — core being down is exactly what the NDJSON/ship/OTel paths
// must record, so it must never move into redact.ts.

import type { ErrorEvent } from '@sentry/nextjs'

import { redactDeep, redactPresignedUrlString } from './redact'

// Re-export so existing imports (tests, tooling) keep one name for it.
export { redactPresignedUrlString } from './redact'

// Type alias for Sentry event (not DOM Event)
type SentryEvent = ErrorEvent

/**
 * Whether the browser SDK should boot.
 *
 * `SENTRY_ENABLED` is three-state, not a boolean: unset follows the build, and an explicit value
 * overrides it in EITHER direction. A plain `production || enabled === 'true'` reads correctly and
 * cannot express the off case — the production arm short-circuits first, so `false` was ignored in
 * the one build that ships Sentry, and `pnpm run start:e2e` (a production build) tunnelled
 * envelopes on every page load.
 */
export function shouldInitSentry(
  nodeEnv: string | undefined,
  sentryEnabled: string | undefined
): boolean {
  if (sentryEnabled === 'false') return false
  return nodeEnv === 'production' || sentryEnabled === 'true'
}

/**
 * Common Sentry options for the browser init and the logger's Sentry sink.
 * Errors only: no tracing options here on purpose (omitting them entirely is
 * what keeps the tracing machinery out of the bundle) and no enableLogs —
 * log shipping is the /api/telemetry pipeline's job.
 */
export const sharedSentryOptions = {
  // NOTE: session health tracking is NOT an option anymore — the old
  // `autoSessionTracking` flag was removed in SDK v9 and was silently
  // ignored here. With defaultIntegrations off, sessions only exist if
  // browserSessionIntegration is registered explicitly (it is, in
  // instrumentation-client.ts).

  // Disable all default integrations to prevent auto-loading 40+ integrations
  defaultIntegrations: false,

  // NEVER enable debug - causes verbose terminal logging
  debug: false,

  // GDPR: Disable automatic PII collection
  sendDefaultPii: false,
} as const

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
const NOISE_SUBSTRINGS = [
  // Server-side: the node or a dependency is unreachable.
  'ECONNREFUSED',
  'ETIMEDOUT',
  // Next.js Server Actions — bot traffic and version skew, not user-affecting.
  'Failed to find Server Action',
  "Missing 'next-action' header",
  // Client-side.
  'NetworkError',
  'Loading chunk',
  'ChunkLoadError',
  'ResizeObserver',
  'Non-Error promise rejection',
]

export function filterNoisyErrors(event: SentryEvent): SentryEvent | null {
  // EVERY value, not just [0]: linkedErrorsIntegration expands an Error `cause`
  // chain into the array and puts the root cause LAST, so a NetworkError wrapped
  // by a TypeError was never matched — the rule below existed but dropped nothing.
  const values = event.exception?.values ?? []

  for (const { type = '', value = '' } of values) {
    if (type === 'NetworkError') return null
    if (NOISE_SUBSTRINGS.some((needle) => value.includes(needle))) return null
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
  // Localhost events are NOT filtered, deliberately. A local production build is how
  // the e2e suite runs, and every real bug found in the 2026-08-25 triage — the missing
  // AbortSignals, the clipboard fallback, a core 500 — surfaced only because those runs
  // reported. Dropping them would have hidden exactly what made the pipeline worth having.

  // First scrub sensitive data
  const scrubbedEvent = scrubSensitiveData(event)
  if (!scrubbedEvent) return null

  // Redact S3 presigned credentials before any noise filtering.
  const presignedScrubbed = scrubPresignedUrls(scrubbedEvent)

  // Then filter noisy errors
  return filterNoisyErrors(presignedScrubbed)
}
