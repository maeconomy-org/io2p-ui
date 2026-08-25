'use client'

import { createClient, type ClientLogger, type Io2pClient } from 'io2p-client'

import { getCachedConfig } from '@/constants/client'

import { getCoreToken } from './auth/client'
import {
  isCallerCancelled,
  isUnreadable,
  markErrorReported,
} from './io2p-errors'
import { logger } from './observability/logger'
import { redactPresignedUrlString } from './observability/redact'

// Default per-request timeout. Mirrors the legacy SDK's 30s and the
// `ClientConfig` per-service timeout convention; `nodeTimeout` (the
// storage-node override, NODE_TIMEOUT env) tunes it per deployment.
export const DEFAULT_IO2P_TIMEOUT_MS = 30_000

/**
 * The SDK's diagnostics logger, adapted onto `@/lib/observability/logger`. Namespaces every
 * record with `scope: 'io2p-client'` and scrubs presigned-URL credentials out
 * of string values — the SDK logs upload URLs on cleanup failures, and an
 * `X-Amz-Signature` in any sink is short-lived write access to the bucket.
 */
function io2pFields(ctx?: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = { scope: 'io2p-client' }
  if (ctx) {
    for (const [key, value] of Object.entries(ctx)) {
      fields[key] =
        typeof value === 'string' ? redactPresignedUrlString(value) : value
    }
  }
  return fields
}

const sdkLogger: ClientLogger = {
  debug: (msg, ctx) => logger.debug(msg, io2pFields(ctx)),
  info: (msg, ctx) => logger.info(msg, io2pFields(ctx)),
  warn: (msg, ctx) => logger.warn(msg, io2pFields(ctx)),
  error: (msg, ctx) => logger.error(msg, io2pFields(ctx)),
}

// Path only — the origin is redundant (one client per node) and the QUERY
// STRING must never reach a sink: S3 presigned URLs authenticate via query
// params, and list cursors/filters are user data.
function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split(/[?#]/, 1)[0]
  }
}

// Lazily-loaded @opentelemetry/api, server only. `undefined` = load not yet
// kicked off, `null` = loading or unavailable. Requests that fire before the
// import settles simply go untraced — traceHeaders must stay synchronous.
type OtelApi = typeof import('@opentelemetry/api')
let otelApi: OtelApi | null | undefined

/**
 * W3C `traceparent` from the active OTel span, so a request made during SSR /
 * route handlers joins the server trace. Browser propagation comes later —
 * and the `typeof window` guard is also what keeps `@opentelemetry/api` out
 * of the client bundle: Next inlines `typeof window`, so the whole branch is
 * dead code client-side. Never throws — tracing must not break the request.
 */
function traceHeaders(): Record<string, string> | undefined {
  if (typeof window !== 'undefined') return undefined
  try {
    if (otelApi === undefined) {
      otelApi = null
      import('@opentelemetry/api').then(
        (mod) => {
          otelApi = mod
        },
        () => {
          // API not resolvable — stay null and keep returning undefined.
        }
      )
      return undefined
    }
    if (otelApi === null) return undefined
    const span = otelApi.trace.getActiveSpan()
    if (!span) return undefined
    const ctx = span.spanContext()
    if (!otelApi.isSpanContextValid(ctx)) return undefined
    const flags = (ctx.traceFlags & 0xff).toString(16).padStart(2, '0')
    return { traceparent: `00-${ctx.traceId}-${ctx.spanId}-${flags}` }
  } catch {
    return undefined
  }
}

/**
 * Build an io2p-client bound to a storage-node origin. The SDK is auth-agnostic
 * — it takes a single `getToken` dependency and owns retry/pagination/errors.
 * One client per node (never a module singleton — the old SDK's trap).
 */
export function createIo2pClient(
  baseUrl: string,
  timeoutMs: number = DEFAULT_IO2P_TIMEOUT_MS
): Io2pClient {
  // Inject a BOUND fetch. The SDK calls its raw fetch as `transport.fetch(url)` for the direct-to-S3
  // PUT (upload orchestrator); an unbound native `fetch` invoked as a method throws "Illegal
  // invocation" (its `this` must be the global). In browsers uploads now default to XHR (byte
  // progress) even with an injected fetch, but the fetch S3 path still exists (`useXhr: false`,
  // non-browser runtimes), so binding once here keeps every path safe.
  return createClient({
    baseUrl,
    getToken: getCoreToken,
    fetch: globalThis.fetch.bind(globalThis),
    timeoutMs,
    logger: sdkLogger,
    onResponse: (info) => {
      const fields = {
        scope: 'io2p-client',
        method: info.method,
        path: pathOf(info.url),
        status: info.status,
        ms: info.durationMs,
        retried: info.retried,
      }
      logger.debug('io2p request', fields)
      if (info.retried) {
        // The silent 401 retry saved this request — worth a warn, because a
        // steady stream of these means token-refresh churn, not one stale JWT.
        logger.warn('io2p 401 retried', fields)
      }
    },
    onError: (err, info) => {
      // `err` under `fields.err` — the logger's Sentry sink captures the real
      // exception in the browser and the server sink NDJSONs the serialized
      // form. No direct Sentry call here: that would double-capture.
      const fields = {
        scope: 'io2p-client',
        err,
        method: info.method,
        path: pathOf(info.url),
        status: info.status,
        ms: info.durationMs,
      }
      if (isCallerCancelled(err)) {
        // Debug, not error: aborts are the caller's own doing (unmounts,
        // superseded queries) and must not reach Sentry or the ship sink.
        // A mint the browser killed during a navigation is the same event one
        // layer down — the request it would have authorised is already gone.
        // Kept distinct from a real outage, which is also a status-0
        // NetworkError but is nobody's caller cancelling anything.
        logger.debug('io2p request aborted', fields)
        return
      }
      if (isUnreadable(info.method, info.status)) {
        // A read the caller is not entitled to — a formula bound by a shared
        // template but never granted, or a row deleted while the page was open.
        // The node answers 403 or 404 for both, and either is an expected state
        // the UI renders around. Only a WRITE that 404s is a real defect: the
        // caller held a reference and acted on it.
        logger.info('io2p resource unreadable', fields)
        markErrorReported(err)
        return
      }
      logger.error('io2p request failed', fields)
      // This failure now HAS an error record. React Query's global handlers
      // see the same object and check this mark rather than logging it twice.
      markErrorReported(err)
    },
    traceHeaders,
  })
}

// One client PER ORIGIN, not per component. `useMemo` is per component
// instance, so the previous version built a fresh Io2pClient in every hook that
// called this — and createEntityHooks calls it in all six of
// useList/useGet/useCreate/useUpdate/useRemove/useRestore, so a single list page
// stood up four or more. Keyed by baseUrl, this still honours "one client per
// node" (the old SDK's module-singleton trap was a single client for ALL nodes).
const clientsByOrigin = new Map<string, Io2pClient>()

/**
 * The io2p-client seam every migrated data hook consumes — distinct from the
 * the only client — the retired SDK and its context are gone.
 */
export function useIomClient(): Io2pClient {
  const config = getCachedConfig()
  const baseUrl = config?.coreBaseUrl ?? ''
  let client = clientsByOrigin.get(baseUrl)
  if (!client) {
    client = createIo2pClient(
      baseUrl,
      config?.nodeTimeout ?? DEFAULT_IO2P_TIMEOUT_MS
    )
    clientsByOrigin.set(baseUrl, client)
  }
  return client
}
