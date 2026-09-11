import { describe, it, expect } from 'vitest'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { rollupRuleErrorMessage } from '@/app/rollup-rules/lib/errors'
import {
  multiplierCollides,
  normalizeRollupPropertyKey,
  rollupRuleCreateBody,
  ROLLUP_AGGREGATIONS,
} from '@/app/rollup-rules/lib/rollup-rule'

const at = (tree: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      tree
    )

const problem = (status: number, detail?: string) => ({ status, detail })

describe('normalizeRollupPropertyKey', () => {
  // A rule matches `search.k` EXACTLY, so it has to land on the key the property field would
  // store. A plain lowercase gave 'concrete mass', which no authored key can ever equal.
  it('resolves to the key a property would be stored under', () => {
    expect(normalizeRollupPropertyKey('  Concrete Mass  ')).toBe(
      'concrete-mass'
    )
    expect(normalizeRollupPropertyKey('concreteMass')).toBe('concretemass')
  })

  it('finds the shared key for a term typed in either language', () => {
    expect(normalizeRollupPropertyKey('Gewicht')).toBe('weight')
    expect(normalizeRollupPropertyKey('Weight')).toBe('weight')
  })

  it('collapses the pair that produces an unexplained 409', () => {
    expect(normalizeRollupPropertyKey('concreteMass')).toBe(
      normalizeRollupPropertyKey('concretemass')
    )
  })

  it('leaves an already-normal key untouched', () => {
    expect(normalizeRollupPropertyKey('co2-equivalent')).toBe('co2-equivalent')
  })

  it('returns empty for whitespace only', () => {
    expect(normalizeRollupPropertyKey('   ')).toBe('')
  })
})

describe('rollupRuleErrorMessage', () => {
  it('reports another account rule as missing, never as denied', () => {
    // 404 covers both "gone" and "someone else's" on purpose — a 403 would confirm it exists.
    expect(rollupRuleErrorMessage(problem(404))).toEqual({
      key: 'rollupRules.errors.notFound',
    })
  })

  it('maps 403 to the built-in read-only message', () => {
    expect(rollupRuleErrorMessage(problem(403))).toEqual({
      key: 'rollupRules.errors.systemReadOnly',
    })
  })

  it('maps 409 to one message covering the live and the deleted holder', () => {
    expect(rollupRuleErrorMessage(problem(409))).toEqual({
      key: 'rollupRules.errors.keyTaken',
    })
  })

  it('surfaces the server detail on 422', () => {
    expect(
      rollupRuleErrorMessage(problem(422, 'propertyKey must match'))
    ).toEqual({
      key: 'rollupRules.errors.invalid',
      values: { detail: 'propertyKey must match' },
    })
  })

  it('falls back to a generic failure when 422 carries no detail', () => {
    expect(rollupRuleErrorMessage(problem(422))).toEqual({
      key: 'common.saveFailed',
    })
  })

  it('maps 401 to the session message rather than a save failure', () => {
    expect(rollupRuleErrorMessage(problem(401))).toEqual({
      key: 'common.sessionExpired',
    })
  })

  it('falls back for a network error and for a non-error value', () => {
    expect(rollupRuleErrorMessage(problem(0))).toEqual({
      key: 'common.saveFailed',
    })
    expect(rollupRuleErrorMessage(undefined)).toEqual({
      key: 'common.saveFailed',
    })
  })
})

/**
 * The keys are a literal union, so TypeScript catches a typo in the mapper — but nothing checks
 * they exist in the catalogue, and a missing one renders the raw key path to the user.
 */
describe('rollup rule message catalogue', () => {
  const statuses = [401, 403, 404, 409, 422, 500]

  it.each(statuses)(
    'resolves the key for status %i in both locales',
    (status) => {
      const { key } = rollupRuleErrorMessage(problem(status, 'detail'))
      expect(at(en, key)).toBeTypeOf('string')
      expect(at(nl, key)).toBeTypeOf('string')
    }
  )

  it.each(ROLLUP_AGGREGATIONS)('labels the %s aggregation', (aggregation) => {
    expect(at(en, `rollupRules.aggregations.${aggregation}`)).toBeTypeOf(
      'string'
    )
    expect(at(nl, `rollupRules.aggregations.${aggregation}`)).toBeTypeOf(
      'string'
    )
  })
})

describe('rollupRuleCreateBody', () => {
  it('omits multiplyBy entirely when none is named', () => {
    expect(rollupRuleCreateBody('mass', 'sum')).toEqual({
      propertyKey: 'mass',
      aggregation: 'sum',
    })
    // Not `multiplyBy: undefined`: the field is optional, and an empty object would be a rule
    // that multiplies by nothing.
    expect('multiplyBy' in rollupRuleCreateBody('mass', 'sum', '  ')).toBe(
      false
    )
  })

  // The multiplier matches the node's index on an exact key, exactly like the rolled-up key —
  // a Dutch-typed "Aantal" has to resolve to what the property field stored.
  it('normalizes the multiplier the same way as the rule key', () => {
    const body = rollupRuleCreateBody('mass', 'sum', 'Aantal')
    expect(body.multiplyBy).toEqual({
      propertyKey: normalizeRollupPropertyKey('Aantal'),
    })
  })
})

describe('multiplierCollides', () => {
  // The node 422s a rule multiplying by its own key. One multiplier over N queued keys rejects
  // exactly one create, and the partial-failure toast cannot say which chip — so the form blocks.
  it('catches a multiplier that is itself queued', () => {
    expect(multiplierCollides('quantity', ['mass', 'quantity'])).toBe(true)
  })

  it('catches it through normalization, not only by exact text', () => {
    const queued = normalizeRollupPropertyKey('Aantal')
    expect(multiplierCollides('Aantal', ['mass', queued])).toBe(true)
  })

  it('allows a multiplier no queued key names', () => {
    expect(multiplierCollides('quantity', ['mass', 'volume'])).toBe(false)
  })

  it('is not a collision when no multiplier is named', () => {
    expect(multiplierCollides('', ['mass'])).toBe(false)
    expect(multiplierCollides('   ', [''])).toBe(false)
  })
})
