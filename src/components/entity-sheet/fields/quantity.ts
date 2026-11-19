import { isRealCalc, type DraftProperty, type DraftValue } from '@/lib/entity'
import type { DerivedValues } from './value-provenance'
import { ruleKey } from './value-normalization'

/** One live value under a rule's multiplier key, as the node sees it. */
export interface QuantityValue {
  num?: number
  /** A formula value's `provenance.unitVerified`. */
  unitVerified?: boolean
  /** A formula value the node could not calculate. */
  failed?: boolean
  /** Typed but not yet read by the node, and not a bare number: its answer is not known here. */
  pending?: boolean
}

export type UnusableReason = 'formulaError' | 'unitNotChecked' | 'unreadable'

export type ResolvedQuantity =
  | { kind: 'number'; value: number }
  | { kind: 'missing' }
  | { kind: 'ambiguous' }
  | { kind: 'pending' }
  | { kind: 'unusable'; reason: UnusableReason | 'quantityNegative' }

/**
 * How the node resolves a rule's multiplier on one object, from every live value under the key
 * across all of its properties (keys need not be unique). In the node's order: no value is
 * missing, several are ambiguous; a single one is unusable when unchecked, without a number or
 * negative. Zero is a real factor. The one copy of that rule on this side.
 */
export function resolveQuantity(
  values: readonly QuantityValue[]
): ResolvedQuantity {
  if (values.length === 0) return { kind: 'missing' }
  if (values.length > 1) return { kind: 'ambiguous' }
  const [only] = values
  if (only.pending) return { kind: 'pending' }
  if (only.unitVerified === false)
    return { kind: 'unusable', reason: 'unitNotChecked' }
  if (only.failed) return { kind: 'unusable', reason: 'formulaError' }
  if (only.num === undefined) return { kind: 'unusable', reason: 'unreadable' }
  if (only.num < 0) return { kind: 'unusable', reason: 'quantityNegative' }
  return { kind: 'number', value: only.num }
}

function sameKey(p: DraftProperty, key: string): boolean {
  return !p.deleted && ruleKey(p.key, p.label) === key
}

/** Every live value of every live property under `key` (lower case) — what the node reads. */
export function valuesUnder(
  properties: readonly DraftProperty[],
  key: string
): DraftValue[] {
  return properties
    .filter((p) => sameKey(p, key))
    .flatMap((p) => p.values.filter((v) => !v.deleted))
}

/**
 * The number the node will compute with for a value in the form: its stored canonical `num` while
 * the text it came from is unchanged, else a just-typed bare number, else unknown until save.
 */
export function draftNum(v: DraftValue): number | undefined {
  const text = (v.data ?? '').trim()
  if (v.parsedFrom?.trim() === text && v.num !== undefined) return v.num
  const leading = Number.parseFloat(text)
  return text !== '' && String(leading) === text ? leading : undefined
}

/** The saved values under `key` (lower case), with what their traces say. */
export function savedQuantityValues(
  properties: readonly DraftProperty[],
  key: string,
  derivedValues: DerivedValues
): QuantityValue[] {
  return valuesUnder(properties, key).map((v) => {
    const trace = v.id ? derivedValues.get(v.id) : undefined
    return {
      num: v.num,
      unitVerified: trace?.unitVerified,
      failed: !!trace?.error,
    }
  })
}

/**
 * The values under `key` as they will be once saved. A blank new row is dropped on save, so it is
 * not a value. A saved formula value keeps its number and trace, also while its recipe is open
 * (unchanged until saved); one turned back into text is typed input. Typed text that is not a
 * bare number has no answer yet: `pending`, not unreadable.
 */
export function draftQuantityValues(
  properties: readonly DraftProperty[],
  key: string,
  derivedValues: DerivedValues
): QuantityValue[] {
  return valuesUnder(properties, key)
    .filter((v) => !!v.id || isRealCalc(v.calc) || (v.data ?? '').trim() !== '')
    .map((v) => {
      const trace =
        v.id && v.calc !== null ? derivedValues.get(v.id) : undefined
      if (trace) {
        return {
          num: v.num,
          unitVerified: trace.unitVerified,
          failed: !!trace.error,
        }
      }
      if (v.calc) return { pending: true }
      const num = draftNum(v)
      const text = (v.data ?? '').trim()
      const read = v.parsedFrom?.trim() === text
      // Cleared text is saved as an empty value, which the node reads as no number: unusable.
      return num === undefined && !read && text !== ''
        ? { pending: true }
        : { num }
    })
}
