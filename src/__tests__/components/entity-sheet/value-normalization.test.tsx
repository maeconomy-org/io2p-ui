import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  ValueNormalization,
  formulaBoundValueIds,
  multiplierKeysOf,
  excludedFromKey,
  refusedReason,
  rollupMultipliers,
  ruleKey,
} from '@/components/entity-sheet/fields/value-normalization'
import type { DraftValue, ValueProvenance } from '@/lib/entity'
import type { ResolvedQuantity } from '@/components/entity-sheet/fields/quantity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

function renderValue(
  value: Partial<DraftValue>,
  usedInFormula = false,
  usedAsMultiplier = false,
  quantity?: ResolvedQuantity
) {
  return render(
    React.createElement(ValueNormalization, {
      value: value as DraftValue,
      quantity,
      usedInFormula,
      usedAsMultiplier,
    })
  )
}

const OK = { ok: true, normVersion: 1 } as const

describe('ValueNormalization', () => {
  it('says nothing when the canonical form is just the raw text again', () => {
    const { container } = renderValue({
      data: '100 kg',
      num: 100,
      unit: 'kg',
      parse: OK,
    })

    expect(container).toBeEmptyDOMElement()
  })

  // The node always renders a space before the unit, so "10m" and "10 m" are the same value —
  // reporting that as a conversion put a marker on every unit-bearing value in the sheet.
  it('treats a missing space as the same value, not a conversion', () => {
    const { container } = renderValue({
      data: '10m',
      num: 10,
      unit: 'm',
      parse: OK,
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('ignores case differences too', () => {
    const { container } = renderValue({
      data: '100  KG',
      num: 100,
      unit: 'kg',
      parse: OK,
    })

    expect(container).toBeEmptyDOMElement()
  })

  // A rule will not scale a total by a quantity the node could not check, with or without a
  // unit: the object drops out of that total, so the row says so where the grey badge would not.
  it('marks an unchecked quantity that a rule multiplies by as excluded', () => {
    renderValue({ data: '1200', num: 1200, parse: OK }, false, true, {
      kind: 'unusable',
      reason: 'unitNotChecked',
    })

    expect(
      screen.getByRole('button', { name: 'objects.properties.unitNotChecked' })
    ).toBeInTheDocument()
  })

  it('leaves a usable quantity alone', () => {
    const { container } = renderValue(
      { data: '4', num: 4, parse: OK },
      false,
      true,
      { kind: 'number', value: 4 }
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('marks a real unit conversion, with the canonical form on the label', () => {
    renderValue({ data: '2 t', num: 2000, unit: 'kg', parse: OK })

    expect(screen.getByRole('button', { name: '2000 kg' })).toBeInTheDocument()
  })

  // A barcode or a serial number never parses as a quantity. That is not a mistake, and flagging it
  // would put a warning on half the properties in the system.
  it('stays silent on an unparseable value nothing computes with', () => {
    const { container } = renderValue({
      data: '123-ABC-456',
      parse: { ok: false, normVersion: 1, reason: 'unknown-unit' },
    })

    expect(container).toBeEmptyDOMElement()
  })

  // Same value, but now a formula depends on it: the node drops it from the calculation, so the
  // result is quietly wrong unless we say so.
  it('warns when a formula depends on a value that would not parse', () => {
    renderValue(
      {
        data: '100 kgs',
        parse: { ok: false, normVersion: 1, reason: 'unknown-unit' },
      },
      true
    )

    expect(
      screen.getByRole('button', { name: 'objects.properties.unknownUnit' })
    ).toBeInTheDocument()
  })

  it('reports a missing number distinctly from a bad unit', () => {
    renderValue(
      {
        data: 'Blue',
        parse: { ok: false, normVersion: 1, reason: 'no-number' },
      },
      true
    )

    expect(
      screen.getByRole('button', { name: 'objects.properties.noNumber' })
    ).toBeInTheDocument()
  })

  // A rollup that scales by this key is the second thing that computes with a value, and it
  // never appears in the formula traces — so the old `usedInFormula` gate rendered nothing while
  // the node dropped this object's WHOLE contribution from the total.
  it('warns when a rollup scales its totals by an unreadable value', () => {
    renderValue(
      {
        // `stuks` until the node learned the Dutch aliases; the fixture then described a value
        // the node reads fine. Any word no table knows will do — the case is about what the card
        // says when a parse FAILED, not about which word fails.
        data: '5 zakken',
        parse: { ok: false, normVersion: 1, reason: 'unknown-unit' },
      },
      false,
      true
    )

    expect(
      screen.getByRole('button', { name: 'objects.properties.unknownUnit' })
    ).toBeInTheDocument()
  })

  it('says nothing for a value the node never normalized', () => {
    const { container } = renderValue({ data: '3' })

    expect(container).toBeEmptyDOMElement()
  })
})

describe('formulaBoundValueIds', () => {
  const provenance = (args: ValueProvenance['args']): ValueProvenance => ({
    expression: 'a + b',
    evalVersion: 1,
    args,
  })

  it('collects every sibling value a recipe reads', () => {
    const bound = formulaBoundValueIds(
      new Map([
        [
          'derived-1',
          provenance([
            { var: 'a', source: { kind: 'property', valueId: 'val-1' } },
            { var: 'b', source: { kind: 'property', valueId: 'val-2' } },
          ]),
        ],
        [
          'derived-2',
          provenance([
            { var: 'a', source: { kind: 'property', valueId: 'val-2' } },
          ]),
        ],
      ])
    )

    expect([...bound].sort()).toEqual(['val-1', 'val-2'])
  })

  // Constants live outside the entity, so they are not values this sheet can warn about.
  it('ignores constant arguments', () => {
    const bound = formulaBoundValueIds(
      new Map([
        [
          'derived-1',
          provenance([
            {
              var: 'a',
              source: { kind: 'constant', constantId: 'c1', version: 1 },
            },
          ]),
        ],
      ])
    )

    expect(bound.size).toBe(0)
  })

  it('tolerates a derived value with no trace', () => {
    expect(formulaBoundValueIds(new Map([['d1', undefined]])).size).toBe(0)
  })
})

describe('multiplierKeysOf', () => {
  it('collects every key a rule multiplies by, lowercased', () => {
    const keys = multiplierKeysOf(
      new Map([
        ['weight', { multiplyBy: { propertyKey: 'Quantity' } }],
        ['volume', { multiplyBy: { propertyKey: 'quantity' } }],
        ['cost', {}],
      ])
    )

    expect([...keys]).toEqual(['quantity'])
  })

  it('is empty when no rule multiplies, and tolerates no rollups at all', () => {
    expect(multiplierKeysOf(new Map([['weight', {}]])).size).toBe(0)
    expect(multiplierKeysOf(undefined).size).toBe(0)
  })
})

// Which consumer is named matters: "not a number" is obvious from the text, "and so your
// building's weight is short by one pump" is not.
describe('excludedFromKey', () => {
  it('names the consumer that will drop the value', () => {
    expect(excludedFromKey(true, false)).toBe(
      'objects.properties.excludedFromFormulas'
    )
    expect(excludedFromKey(false, true)).toBe(
      'objects.properties.excludedFromRollups'
    )
    expect(excludedFromKey(true, true)).toBe(
      'objects.properties.excludedFromBoth'
    )
  })
})

describe('rollupMultipliers', () => {
  it('maps what the node applied, key to multiplier, in lower case', () => {
    const rollups = new Map([
      ['r1', { propertyKey: 'Mass', multiplyBy: { propertyKey: 'Quantity' } }],
      ['r2', { propertyKey: 'volume' }],
    ])
    expect(rollupMultipliers(rollups)).toEqual(new Map([['mass', 'quantity']]))
  })
})

describe('ruleKey', () => {
  // Core compares a saved key lower-cased and otherwise untouched; slugging it would miss a key
  // written through the API.
  it('keeps a saved key as core compares it', () => {
    expect(ruleKey('Mass')).toBe('mass')
    expect(ruleKey('items_per_box')).toBe('items_per_box')
  })

  // A property with no key yet has only its label; the rule form resolves it through the
  // dictionary, so a Dutch label reaches the key the rule stores.
  it('resolves a label the way the rule form does when there is no key', () => {
    expect(ruleKey(undefined, 'Aantal')).toBe('quantity')
  })
})

describe('refusedReason', () => {
  it('names why a rule refuses the quantity under a key', () => {
    expect(refusedReason({ kind: 'ambiguous' })).toBe('quantitySeveral')
    expect(refusedReason({ kind: 'unusable', reason: 'formulaError' })).toBe(
      'formulaError'
    )
    expect(
      refusedReason({ kind: 'unusable', reason: 'quantityNegative' })
    ).toBe('quantityNegative')
  })

  // Unreadable text has its own mark already.
  it('leaves a usable, missing or unreadable quantity to the rest of the row', () => {
    expect(refusedReason({ kind: 'number', value: 0 })).toBeUndefined()
    expect(refusedReason({ kind: 'missing' })).toBeUndefined()
    expect(
      refusedReason({ kind: 'unusable', reason: 'unreadable' })
    ).toBeUndefined()
    expect(refusedReason(undefined)).toBeUndefined()
  })
})

describe('a quantity a rule refuses, on its row', () => {
  it('marks every value when there are several', () => {
    renderValue({ data: '4', num: 4, parse: OK }, false, true, {
      kind: 'ambiguous',
    })
    expect(
      screen.getByRole('button', { name: 'objects.properties.quantitySeveral' })
    ).toBeInTheDocument()
  })

  it('marks a failed formula used as the quantity', () => {
    renderValue({ data: '' }, false, true, {
      kind: 'unusable',
      reason: 'formulaError',
    })
    expect(
      screen.getByRole('button', { name: 'objects.properties.formulaError' })
    ).toBeInTheDocument()
  })

  it('says nothing about it when no rule multiplies by the key', () => {
    const { container } = renderValue(
      { data: '-2', num: -2, parse: OK },
      false,
      false,
      { kind: 'unusable', reason: 'quantityNegative' }
    )
    expect(container).toBeEmptyDOMElement()
  })
})
