import { ApiError } from 'io2p-client'

// Message keys a failed entity write can map to. A literal union (rather than `string`) so a typo
// or a removed translation key is a typecheck failure, not a runtime "objects.saveError.foo" render.
export type SaveErrorKey =
  | 'objects.saveError.conflict'
  | 'objects.saveError.invalid'
  | 'objects.saveError.notFound'
  | 'objects.permissionDenied'
  | 'common.sessionExpired'
  | 'common.saveFailed'

export interface SaveErrorMessage {
  key: SaveErrorKey
  values?: { detail: string }
}

// `instanceof` narrows the common case, but a duplicated module copy (ESM + CJS in one graph) would
// make it silently false, so fall back to reading the shape. io2p errors carry a numeric `status`.
export function iomStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error as { status: unknown }
    if (typeof status === 'number') return status
  }
  return undefined
}

// `NetworkError` (fetch itself rejected — node down, DNS, CORS) carries status 0, the XHR
// "no response" convention, so "node unreachable" is distinguishable from every HTTP status
// without `instanceof` (same dual-module-copy hazard as above).
export function isNodeUnreachable(error: unknown): boolean {
  return iomStatus(error) === 0
}

// `TimeoutError` is a `NetworkError` subclass (status 0 too); the SDK contract is to
// discriminate it by `name`, never `instanceof`.
export function isTimeout(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name: unknown }).name === 'TimeoutError'
  }
  return false
}

/**
 * A caller cancellation, not a failure: the SDK fires onError for aborts too, and React Query
 * aborts in-flight queries on unmount — ordinary navigation would otherwise manufacture
 * error-level telemetry (shipped AND Sentry-captured). AbortError may arrive raw (DOMException)
 * or as the `cause` of the SDK's wrapper error. TimeoutError is NOT an abort — a request that ran
 * out of budget is a real failure and stays at error.
 *
 * Lives here rather than in `io2p.ts` so the React Query error handlers can share it: `io2p.ts` is
 * `'use client'` and owns client construction, this module is neutral error vocabulary.
 */
export function isCallerAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  if (name === 'AbortError') return true
  if (name === 'TimeoutError') return false
  const cause = (error as { cause?: unknown }).cause
  if (cause && typeof cause === 'object') {
    return (cause as { name?: unknown }).name === 'AbortError'
  }
  return false
}

/**
 * A token mint the browser killed mid-flight, which it does to every in-flight request during a
 * client-side navigation. The transport names this case specifically (`NetworkError` carrying
 * `token mint interrupted`) rather than leaving it as the bare `TypeError` fetch throws, because a
 * cancelled mint is indistinguishable from a rejected credential by shape alone.
 *
 * Keyed on the detail, NOT on `status === 0`: a real outage is a NetworkError with status 0 too,
 * and that one must keep reaching Sentry. This is the caller abandoning its own request.
 */
export function isMintInterrupted(error: unknown): boolean {
  return (
    isNodeUnreachable(error) && iomDetail(error) === 'token mint interrupted'
  )
}

/**
 * The caller's own doing, by any route: an explicit abort, or a token mint the browser killed
 * during a navigation. Neither is a failure to report — the request they belong to is already gone.
 *
 * One predicate rather than `isCallerAbort(e) || isMintInterrupted(e)` repeated at each handler.
 * When `isMintInterrupted` was added, only ONE of the three call sites learned about it and four
 * records kept reaching Sentry from the other two. A widened vocabulary has to widen everywhere.
 */
export function isCallerCancelled(error: unknown): boolean {
  return isCallerAbort(error) || isMintInterrupted(error)
}

const READ_METHODS = new Set(['GET', 'HEAD'])

/**
 * A read the caller is not entitled to, or of something no longer there — routine in a shared
 * workspace, not a defect. A template shares the formulas it binds only if the sharer opted in, so
 * the bound ids resolve to 403/404 for everyone else; a row can also be deleted while a page holds
 * its id. The node uses both statuses for this (404 avoids leaking existence), so neither alone is
 * a reliable signal.
 *
 * Restricted to reads on purpose: a WRITE that 404s means the caller held a reference and acted on
 * it, which stays at error level.
 */
export function isUnreadable(method: string, status?: number): boolean {
  if (!READ_METHODS.has(method.toUpperCase())) return false
  return status === 403 || status === 404
}

// Marks an error the SDK's own onError hook has ALREADY logged at error level (with method, path,
// status and duration). React Query's global handlers see the same object again and would produce
// a second error record for one failure — doubling ship volume and Sentry captures.
//
// A non-enumerable symbol: invisible to JSON.stringify, to spreads and to the log serializer, so
// the mark never reaches a sink.
const REPORTED = Symbol.for('io2p.errorReported')

export function markErrorReported(error: unknown): void {
  if (!error || typeof error !== 'object') return
  try {
    Object.defineProperty(error, REPORTED, {
      value: true,
      enumerable: false,
      configurable: true,
    })
  } catch {
    // Frozen or sealed error — worst case the failure is logged twice.
  }
}

export function wasErrorReported(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as Record<symbol, unknown>)[REPORTED] === true
}

// The problem+json `detail` — server prose naming the rule that rejected the write. Only worth
// surfacing for 422, where it tells the user which field to fix.
export function iomDetail(error: unknown): string | undefined {
  if (error instanceof ApiError) return error.detail
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const { detail } = error as { detail: unknown }
    if (typeof detail === 'string' && detail.trim() !== '') return detail
  }
  return undefined
}

/**
 * Map a failed entity write to a translated message. Pure (no `t`), so the caller does
 * `toast.error(t(m.key, m.values))` and this stays unit-testable with plain objects.
 *
 * 409 and 412 collapse to one message: io2p emits an identical body for a plain conflict and a lost
 * optimistic-concurrency race, and the user's recovery is the same either way.
 */
export function saveErrorMessage(error: unknown): SaveErrorMessage {
  switch (iomStatus(error)) {
    case 401:
      return { key: 'common.sessionExpired' }
    case 403:
      return { key: 'objects.permissionDenied' }
    case 404:
      return { key: 'objects.saveError.notFound' }
    case 409:
    case 412:
      return { key: 'objects.saveError.conflict' }
    case 422: {
      const detail = iomDetail(error)
      return detail
        ? { key: 'objects.saveError.invalid', values: { detail } }
        : { key: 'common.saveFailed' }
    }
    default:
      return { key: 'common.saveFailed' }
  }
}
