import { iomDetail, iomStatus } from './io2p-errors'

/**
 * Why a list could not load, for the place the list would be. By the STATUS first: a network
 * error carries a `detail` too. A 400 or 422 is the node refusing this list (too slow, a filter it
 * does not take), and its `detail` says what to change; the node writes it in English. Anything
 * else (no answer, 5xx) is worth a retry.
 */
export function listErrorMessage(
  error: unknown,
  online = true
):
  | { key: 'common.listRefused'; detail: string }
  | { key: 'common.listFailed' }
  | { key: 'common.listOffline' } {
  if (!online) return { key: 'common.listOffline' }
  const status = iomStatus(error)
  const detail = iomDetail(error)
  if ((status === 400 || status === 422) && detail) {
    return { key: 'common.listRefused', detail }
  }
  return { key: 'common.listFailed' }
}
