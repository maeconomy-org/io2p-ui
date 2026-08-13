import { describe, it, expect } from 'vitest'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { rollupRuleErrorMessage } from '@/app/rollup-rules/lib/errors'
import {
  normalizeRollupPropertyKey,
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
  it('trims and lowercases, matching what the server stores', () => {
    expect(normalizeRollupPropertyKey('  Concrete Mass  ')).toBe(
      'concrete mass'
    )
    expect(normalizeRollupPropertyKey('concreteMass')).toBe('concretemass')
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
