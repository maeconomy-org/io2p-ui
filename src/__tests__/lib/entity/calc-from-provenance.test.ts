import { describe, it, expect } from 'vitest'

import { calcFromProvenance } from '@/lib/entity'
import type { ValueProvenance } from '@/lib/entity'

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
    const result = calcFromProvenance(provenance())

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

  // The trace and the recipe both address a constant by id, so this needs no directory and cannot
  // fail to resolve one — the whole `unknownConstant` failure went with the name binding.
  it('binds a constant by its id', () => {
    const result = calcFromProvenance(
      provenance({
        args: [
          {
            var: 'a',
            source: { kind: 'constant', constantId: 'c1', version: 2 },
            value: 0.5,
          },
        ],
      })
    )

    expect(result).toEqual({
      ok: true,
      calc: { formulaId: 'f1', args: [{ var: 'a', constantId: 'c1' }] },
    })
  })

  // A version pin is the SERVER's business: it re-pins at bind time, so carrying the old version
  // into an editable recipe would freeze a value the user never chose.
  it('carries no version pin into the editable recipe', () => {
    const result = calcFromProvenance(
      provenance({
        args: [
          {
            var: 'a',
            source: { kind: 'constant', constantId: 'c1', version: 7 },
            value: 0.5,
          },
        ],
      })
    )

    expect(result.ok && result.calc.args[0]).not.toHaveProperty('version')
  })

  // The editor picks stored formulas; it has no expression input, so an inline recipe would come
  // back as an empty picker and be lost on save.
  it('refuses an inline expression it has no editor for', () => {
    const result = calcFromProvenance(provenance({ formulaId: undefined }))

    expect(result).toEqual({ ok: false, reason: 'inlineExpression' })
  })
})
