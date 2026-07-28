import { describe, it, expect } from 'vitest'

import { calcFromProvenance } from '@/lib/entity-body'
import type { ValueProvenance } from '@/lib/entity-body'

const NO_CONSTANTS = new Map<string, string>()

function provenance(over: Partial<ValueProvenance> = {}): ValueProvenance {
  return {
    expression: 'a * b',
    evalVersion: 1,
    formulaId: 'f1',
    args: [
      { var: 'a', source: { kind: 'property', valueId: 'val-1' }, value: 3 },
      { var: 'b', source: { kind: 'property', valueId: 'val-2' }, value: 2 },
    ],
    ...over,
  }
}

describe('calcFromProvenance', () => {
  // The node seeds every existing value id as its own ref, so a resolved valueId round-trips
  // straight back into an editable binding.
  it('binds sibling values by their existing id', () => {
    const result = calcFromProvenance(provenance(), NO_CONSTANTS)

    expect(result).toEqual({
      ok: true,
      calc: {
        formulaId: 'f1',
        args: [
          { var: 'a', ref: 'val-1' },
          { var: 'b', ref: 'val-2' },
        ],
      },
    })
  })

  it('binds a constant by name once the directory resolves it', () => {
    const result = calcFromProvenance(
      provenance({
        args: [
          {
            var: 'a',
            source: { kind: 'constant', constantId: 'c1', version: 2 },
            value: 0.5,
          },
        ],
      }),
      new Map([['c1', 'co2_factor']])
    )

    expect(result).toEqual({
      ok: true,
      calc: { formulaId: 'f1', args: [{ var: 'a', constant: 'co2_factor' }] },
    })
  })

  // Dropping the binding would 422 on the missing variable, or — worse — save a recipe bound to
  // fewer inputs than the one the user was looking at.
  it('refuses rather than drop a constant it cannot name', () => {
    const result = calcFromProvenance(
      provenance({
        args: [
          {
            var: 'a',
            source: { kind: 'constant', constantId: 'c-unknown', version: 1 },
          },
        ],
      }),
      NO_CONSTANTS
    )

    expect(result).toEqual({ ok: false, reason: 'unknownConstant' })
  })

  // The editor picks stored formulas; it has no expression input, so an inline recipe would come
  // back as an empty picker and be lost on save.
  it('refuses an inline expression it has no editor for', () => {
    const result = calcFromProvenance(
      provenance({ formulaId: undefined }),
      NO_CONSTANTS
    )

    expect(result).toEqual({ ok: false, reason: 'inlineExpression' })
  })
})
