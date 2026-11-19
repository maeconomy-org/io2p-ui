import { describe, it, expect } from 'vitest'

import {
  draftNum,
  draftQuantityValues,
  resolveQuantity,
  savedQuantityValues,
} from '@/components/entity-sheet/fields/quantity'
import type { DraftProperty } from '@/lib/entity'
import type { DerivedValues } from '@/components/entity-sheet/fields/value-provenance'

const trace = (extra: Record<string, unknown> = {}) => ({
  expression: 'v * q',
  evalVersion: 3,
  args: [],
  ...extra,
})

const prop = (
  key: string,
  values: DraftProperty['values'],
  extra: Partial<DraftProperty> = {}
): DraftProperty => ({ id: `p-${key}`, key, label: key, values, ...extra })

describe('resolveQuantity', () => {
  it('reads one usable value as its number, zero included', () => {
    expect(resolveQuantity([{ num: 4 }])).toEqual({ kind: 'number', value: 4 })
    expect(resolveQuantity([{ num: 0 }])).toEqual({ kind: 'number', value: 0 })
  })

  it('is missing with no value, and ambiguous with several', () => {
    expect(resolveQuantity([])).toEqual({ kind: 'missing' })
    expect(resolveQuantity([{ num: 4 }, { num: 2 }])).toEqual({
      kind: 'ambiguous',
    })
  })

  // The node checks the unchecked mark before the number, so an unchecked value is unusable
  // even with a perfectly good number.
  it('refuses a single value the node cannot use, and says why', () => {
    expect(resolveQuantity([{ num: 1200, unitVerified: false }])).toEqual({
      kind: 'unusable',
      reason: 'unitNotChecked',
    })
    expect(resolveQuantity([{ failed: true }])).toEqual({
      kind: 'unusable',
      reason: 'formulaError',
    })
    expect(resolveQuantity([{}])).toEqual({
      kind: 'unusable',
      reason: 'unreadable',
    })
    expect(resolveQuantity([{ num: -4 }])).toEqual({
      kind: 'unusable',
      reason: 'quantityNegative',
    })
  })
})

describe('savedQuantityValues', () => {
  // Keys need not be unique, and the node reads every live value under one.
  it('reads every live property under the key, whatever its case', () => {
    const properties = [
      prop('Quantity', [{ id: 'a', data: '4', num: 4 }]),
      prop('quantity', [{ id: 'b', data: '2', num: 2 }]),
    ]
    expect(
      resolveQuantity(savedQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'ambiguous' })
  })

  it('leaves out deleted properties and deleted values', () => {
    const properties = [
      prop('quantity', [
        { id: 'a', data: '4', num: 4 },
        { id: 'b', data: '9', num: 9, deleted: true },
      ]),
      prop('quantity', [{ id: 'c', data: '2', num: 2 }], { deleted: true }),
    ]
    expect(
      resolveQuantity(savedQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'number', value: 4 })
  })

  it('takes what a formula value’s trace says', () => {
    const derived = new Map([
      ['a', trace({ unitVerified: false })],
    ]) as DerivedValues
    expect(
      savedQuantityValues(
        [prop('quantity', [{ id: 'a', data: '1200', num: 1200 }])],
        'quantity',
        derived
      )
    ).toEqual([{ num: 1200, unitVerified: false, failed: false }])
  })
})

describe('draftQuantityValues', () => {
  // A blank new row is dropped on save, so it is not a second quantity.
  it('ignores a blank row that has not been saved', () => {
    const properties = [
      prop('quantity', [
        { id: 'a', data: '4', num: 4, parsedFrom: '4' },
        { ref: 'new', data: '' },
      ]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'number', value: 4 })
  })

  // The stored number belongs to the old text until the value is read back.
  it('judges an edited value by what was typed, not by its old number', () => {
    const properties = [
      prop('quantity', [{ id: 'a', data: '-4', num: 4, parsedFrom: '4' }]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'unusable', reason: 'quantityNegative' })
  })

  // Turned back into text, the old trace no longer describes the value.
  it('drops a formula value’s trace once it is turned back into text', () => {
    const derived = new Map([
      ['a', trace({ unitVerified: false })],
    ]) as DerivedValues
    const properties = [
      prop('quantity', [
        { id: 'a', data: '20', calc: null, parsedFrom: '1200' },
      ]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', derived))
    ).toEqual({ kind: 'number', value: 20 })
  })

  it('counts a text value it cannot read, so two values are still several', () => {
    const properties = [
      prop('quantity', [
        { id: 'a', data: '4', num: 4, parsedFrom: '4' },
        { id: 'b', data: 'about ten', parsedFrom: 'about ten' },
      ]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'ambiguous' })
  })

  // Typed text that is not a bare number is read by the node on save: unknown, not refused.
  it('treats typed text the node has not read yet as not known', () => {
    const properties = [prop('quantity', [{ ref: 'r', data: '2 stuks' }])]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'pending' })
  })

  // Opening a saved formula's recipe changes nothing until saved.
  it('keeps a saved formula value’s number and trace while its recipe is open', () => {
    const derived = new Map([
      ['a', trace({ unitVerified: true })],
    ]) as DerivedValues
    const properties = [
      prop('quantity', [
        {
          id: 'a',
          data: '3',
          num: 3,
          parsedFrom: '3',
          calc: { formulaId: 'f-1', args: [] },
        },
      ]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', derived))
    ).toEqual({ kind: 'number', value: 3 })
  })

  it('treats a new formula value as not known until it is saved', () => {
    const properties = [
      prop('quantity', [{ ref: 'r', calc: { formulaId: 'f-1', args: [] } }]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'pending' })
  })
})

describe('draftNum', () => {
  it('uses the stored number while its text is unchanged', () => {
    expect(draftNum({ data: '10 t', num: 10000, parsedFrom: '10 t' })).toBe(
      10000
    )
  })

  it('uses a just-typed bare number, and nothing else', () => {
    expect(draftNum({ data: '42' })).toBe(42)
    expect(
      draftNum({ data: '10 m', num: 10000, parsedFrom: '10 t' })
    ).toBeUndefined()
    expect(draftNum({ data: '' })).toBeUndefined()
  })

  it('reads a saved value whose text was cleared as no number, not as unknown', () => {
    const properties = [
      prop('quantity', [{ id: 'a', data: '', num: 4, parsedFrom: '4' }]),
    ]
    expect(
      resolveQuantity(draftQuantityValues(properties, 'quantity', new Map()))
    ).toEqual({ kind: 'unusable', reason: 'unreadable' })
  })
})
