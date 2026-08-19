import type { RollupRuleDTO } from 'io2p-client'

import { resolveKey } from '@/constants/property-dictionary'

export const ROLLUP_AGGREGATIONS = ['sum'] as const

export type RollupAggregation = RollupRuleDTO['aggregation']

/**
 * Turn a typed rule key into the key a property would actually be stored under.
 *
 * This MUST be the same resolution the property name field applies, not merely a lowercase: a rule
 * matches `search.k` exactly, so "Concrete Mass" typed here has to become `concrete-mass` — what
 * the property field stores — and not `concrete mass`, which would match nothing forever while
 * looking perfectly correct in the rules table.
 *
 * It also means a rule typed in Dutch finds the same key as a property typed in English, because
 * both go through the dictionary.
 */
export function normalizeRollupPropertyKey(input: string): string {
  return resolveKey(input).key
}
