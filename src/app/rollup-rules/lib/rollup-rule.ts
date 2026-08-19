import type { RollupRuleDTO } from 'io2p-client'

export const ROLLUP_AGGREGATIONS = ['sum'] as const

export type RollupAggregation = RollupRuleDTO['aggregation']

/**
 * The server lowercases and trims, so `concreteMass` and `concretemass` are one key. Applied in the
 * form too, or the collision surfaces only as a 409 on two strings the user typed differently.
 */
export function normalizeRollupPropertyKey(input: string): string {
  return input.trim().toLowerCase()
}
