import { iomStatus, iomDetail } from '@/lib/io2p-errors'

export type RollupRuleErrorKey =
  | 'rollupRules.errors.notFound'
  | 'rollupRules.errors.systemReadOnly'
  | 'rollupRules.errors.keyTaken'
  | 'rollupRules.errors.invalid'
  | 'common.saveFailed'
  | 'common.sessionExpired'

export interface RollupRuleErrorMessage {
  key: RollupRuleErrorKey
  values?: { detail: string }
}

/**
 * Map a failed rollup-rule write to a translated message.
 *
 * Two statuses carry more than one cause and the API gives nothing to tell them apart:
 *
 * - 404 is both "gone" and "belongs to someone else" — deliberately, so an error code cannot
 *   confirm a stranger's rule exists. The message must not say "no access" where the API says
 *   "not found".
 * - 409 is both "a live rule holds this key" and "a DELETED rule holds this key". The form
 *   pre-checks the visible rules, so the one that reaches here is usually the deleted one — hence
 *   a single message that names the recovery the user cannot see.
 *
 * TODO(byrhn): ask io2p-core for a discriminator on the two 422 quotas — per-user and node-wide
 * need different sentences, and the node-wide one is checked first, so a user sitting at 3 of 20
 * can be blocked by other people's rules.
 */
export function rollupRuleErrorMessage(error: unknown): RollupRuleErrorMessage {
  switch (iomStatus(error)) {
    case 401:
      return { key: 'common.sessionExpired' }
    case 403:
      return { key: 'rollupRules.errors.systemReadOnly' }
    case 404:
      return { key: 'rollupRules.errors.notFound' }
    case 409:
      return { key: 'rollupRules.errors.keyTaken' }
    case 422: {
      const detail = iomDetail(error)
      return detail
        ? { key: 'rollupRules.errors.invalid', values: { detail } }
        : { key: 'common.saveFailed' }
    }
    default:
      return { key: 'common.saveFailed' }
  }
}
