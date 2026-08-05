import { IomError } from 'io2p-client'

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
  if (error instanceof IomError) return error.status
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

// The problem+json `detail` — server prose naming the rule that rejected the write. Only worth
// surfacing for 422, where it tells the user which field to fix.
export function iomDetail(error: unknown): string | undefined {
  if (error instanceof IomError) return error.detail
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
