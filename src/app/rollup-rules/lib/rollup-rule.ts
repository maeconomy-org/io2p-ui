/**
 * The rollup-rule shape, mirrored locally because `io2p-client` does not expose the resource yet.
 *
 * Field names and conventions follow the node's other library DTOs (epoch-ms timestamps, `system`
 * tier flag, `ownerName` resolved on read) so that swapping this for the generated type is a
 * delete, not a rewrite.
 */

export const ROLLUP_AGGREGATIONS = ['sum'] as const

export type RollupAggregation = (typeof ROLLUP_AGGREGATIONS)[number]

export interface RollupRuleDTO {
  id: string
  propertyKey: string
  aggregation: RollupAggregation
  system: boolean
  ownerUserId?: string
  ownerName?: string
  createdAt: number
  updatedAt: number
  deleted: boolean
  deletedAt?: number
}

export interface CreateRollupRuleBody {
  propertyKey: string
  aggregation: RollupAggregation
}

export interface ListRollupRulesQuery {
  page: number
  size: number
  sort?: 'createdAt' | '-createdAt'
  /** Tier filter: `true` built-in only, `false` your own only, omitted for both. */
  system?: boolean
  deleted?: 'exclude' | 'include' | 'only'
}

/**
 * The server lowercases and trims, so `concreteMass` and `concretemass` are one key. Applied in the
 * form too, or the collision surfaces only as a 409 on two strings the user typed differently.
 */
export function normalizeRollupPropertyKey(input: string): string {
  return input.trim().toLowerCase()
}
