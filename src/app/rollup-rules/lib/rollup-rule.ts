import type { CreateRollupRuleBody, RollupRuleDTO } from 'io2p-client'

import { getDictionaryEntry, resolveKey } from '@/constants/property-dictionary'

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

/**
 * Dictionary categories whose members never hold a summable number.
 *
 * An ALLOW-LIST of the certain cases, not a guess at the rest. The obvious
 * heuristics both fail: presence of a `valuePlaceholder` is not a numeric
 * signal (`postal-code`, `serial-number`, `ifc-class` all have one), and a
 * placeholder starting with a digit catches every date plus `barcode`,
 * `coordinates` and `nl-sfb-classification`.
 *
 * `lifecycle` is deliberately absent even though most of it is dates: it also
 * holds `lifespan-years` and `duration`, which are genuinely summable.
 */
const NON_NUMERIC_CATEGORIES = new Set([
  'appearance',
  'composition',
  'contact',
  'meta',
  'ownership',
  'state',
])

/**
 * Text keys inside an otherwise numeric category. `location` holds `latitude`,
 * `longitude` and `floor`, so the category cannot be listed wholesale; these
 * members of it are still certainly text.
 */
const NON_NUMERIC_KEYS = new Set([
  'address',
  'street',
  'city',
  'state',
  'country',
  'country-of-origin',
  'room',
  'building',
  'manufacturer',
  'supplier',
  'model',
  'serial-number',
  'product-code',
  'batch-number',
  'barcode',
  'certification',
  'energy-label',
  'currency',
  'unit',
  'ifc-class',
  'fire-rating',
  'map-url',
  'epd-url',
  'coordinates',
  'nl-sfb-classification',
])

/**
 * True when a rollup on this key will certainly never produce a number.
 *
 * Deliberately silent on anything it cannot be sure of — an unknown key is
 * free-text as often as not, and a warning that fires on a valid key teaches
 * the user to dismiss the one that matters. It answers "is this certainly
 * text", never "is this numeric".
 */
export function isCertainlyNonNumericKey(key: string): boolean {
  if (NON_NUMERIC_KEYS.has(key)) return true
  const entry = getDictionaryEntry(key)
  if (!entry?.category) return false
  return NON_NUMERIC_CATEGORIES.has(entry.category)
}

/**
 * The create body for one queued key, under the form's shared aggregation and multiplier.
 *
 * `multiplyBy` is OMITTED rather than sent empty — the field is optional on the node, and an empty
 * object would be a rule that multiplies by nothing.
 */
export function rollupRuleCreateBody(
  propertyKey: string,
  aggregation: RollupAggregation,
  multiplierKey?: string
): CreateRollupRuleBody {
  const multiplyBy = normalizeRollupPropertyKey(multiplierKey ?? '')
  return {
    propertyKey,
    aggregation,
    ...(multiplyBy ? { multiplyBy: { propertyKey: multiplyBy } } : {}),
  }
}

/**
 * Whether the shared multiplier names a key that is itself queued.
 *
 * The node 422s a rule that multiplies by its own key. One multiplier over N queued keys means
 * that rejects exactly ONE create while the rest succeed — and the partial-failure toast cannot
 * say which chip was at fault, so the form blocks the submit and names the collision instead.
 */
export function multiplierCollides(
  multiplierKey: string,
  queuedKeys: readonly string[]
): boolean {
  const normalized = normalizeRollupPropertyKey(multiplierKey)
  return normalized !== '' && queuedKeys.includes(normalized)
}
