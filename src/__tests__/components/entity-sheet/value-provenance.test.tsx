import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  ValueProvenanceDisplay,
  labelForValueId,
  uncheckedState,
} from '@/components/entity-sheet/fields/value-provenance'
import type { DraftProperty, ValueProvenance } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

// Only the opened details fetch: the formula's name and the constants' names.
vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useGet: (id?: string) => ({ data: id ? { name: 'Area' } : undefined }),
  }),
  useConstants: () => ({
    useByIds: () => new Map([['const-1', { name: 'factor' }]]),
  }),
}))

const PROVENANCE: ValueProvenance = {
  expression: 'a * b',
  evalVersion: 1,
  args: [
    { var: 'a', source: { kind: 'property', valueId: 'val-1' }, value: 3 },
    {
      var: 'b',
      source: { kind: 'constant', constantId: 'const-1', version: 2 },
      value: 0.5,
    },
  ],
}

function renderProvenance(
  provenance: ValueProvenance,
  unit?: string,
  textForValue: (id: string) => string | undefined = (id) =>
    id === 'val-1' ? '3 m' : undefined
) {
  return render(
    React.createElement(ValueProvenanceDisplay, {
      provenance,
      unit,
      display: '1.5 m',
      labelForValue: (id: string) => (id === 'val-1' ? 'Height' : undefined),
      textForValue,
    })
  )
}

const openDetails = () => fireEvent.click(screen.getByTestId('provenance-chip'))

describe('ValueProvenanceDisplay', () => {
  it('shows the formula with its inputs written in, and keeps the details closed', () => {
    renderProvenance(PROVENANCE)

    expect(screen.getByTestId('provenance-equation')).toHaveTextContent(
      '= 3 m × 0.5'
    )
    expect(screen.queryByText('a * b')).not.toBeInTheDocument()
    expect(screen.getByTestId('provenance-chip')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  // A sibling's stored number is in its canonical unit (2 kW is 2000): printing it would show a
  // figure nobody typed. A constant's number is the one it was read as.
  it('names an input whose row it cannot read, and keeps a constant’s number', () => {
    renderProvenance(PROVENANCE, undefined, () => undefined)

    expect(screen.getByTestId('provenance-equation')).toHaveTextContent(
      '= a × 0.5'
    )
  })

  it('opens to the formula by name, each input with its text, and the constant by name', () => {
    renderProvenance({ ...PROVENANCE, formulaId: 'f-1' })
    openDetails()

    // The row already shows the formula as its equation; the details name it, not repeat it.
    expect(screen.getByTestId('provenance-formula')).toHaveTextContent('Area')
    expect(screen.queryByText('a * b')).toBeNull()
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByText('3 m')).toBeInTheDocument()
    expect(screen.getByText('factor')).toBeInTheDocument()
    expect(screen.getByText('0.5')).toBeInTheDocument()
  })

  // A failed formula used to render as an ordinary empty value: nothing said it had broken.
  it('surfaces an evaluation error with an icon and text, and says why on the row', () => {
    renderProvenance({
      ...PROVENANCE,
      error: { code: 'arg-not-numeric', detail: 'Height is not a number' },
    })

    expect(screen.getByTestId('provenance-error')).toHaveTextContent(
      'objects.properties.formulaError'
    )
    expect(screen.getByTestId('provenance-reason')).toHaveTextContent(
      'objects.properties.calcError.arg-not-numeric'
    )

    openDetails()
    expect(screen.getByText('Height is not a number')).toBeInTheDocument()
  })

  // The codes are an OPEN set and `detail` is English by contract, so an unrecognised code gets a
  // translated sentence rather than an identifier printed at the reader.
  it('does not show a raw error code for a code it does not know', () => {
    renderProvenance({
      ...PROVENANCE,
      error: { code: 'cycle', detail: '' },
    })
    // The fallback sentence is what the badge already says: no reason line repeats it.
    expect(screen.queryByTestId('provenance-reason')).toBeNull()
    openDetails()

    expect(screen.queryByText('cycle')).not.toBeInTheDocument()
    // Twice: the badge and the status line.
    expect(screen.getAllByText('objects.properties.formulaError')).toHaveLength(
      2
    )
  })

  it('translates a known error code and keeps detail as the diagnostic line', () => {
    renderProvenance({
      ...PROVENANCE,
      error: { code: 'dimension-mismatch', detail: 'kg vs m' },
    })
    openDetails()

    expect(
      screen.getAllByText('objects.properties.calcError.dimension-mismatch')
    ).toHaveLength(2)
    expect(screen.getByText('kg vs m')).toBeInTheDocument()
  })

  it('names the unit the formula declared', () => {
    renderProvenance({
      ...PROVENANCE,
      unitSource: 'declared',
      declaredUnit: 'J',
    })
    openDetails()

    expect(screen.getByTestId('provenance-unit')).toHaveTextContent(
      'objects.properties.resultDeclared:{"unit":"J"}'
    )
  })

  // Inherited FLOATS — it is re-derived from live siblings on every recompute, so the wording says
  // where it came from rather than presenting it as fixed.
  it('says when the unit came from the values instead', () => {
    renderProvenance({ ...PROVENANCE, unitSource: 'inherited' }, 'kg')
    openDetails()

    expect(screen.getByTestId('provenance-unit')).toHaveTextContent(
      'objects.properties.resultInherited:{"unit":"kg"}'
    )
  })

  it('survives a unitSource this build has never heard of', () => {
    renderProvenance({ ...PROVENANCE, unitSource: 'inferred' })
    openDetails()

    expect(screen.getByTestId('provenance-unit')).toHaveTextContent('inferred')
  })

  it('shows the expression of an inline formula, which has no name', () => {
    renderProvenance(PROVENANCE)
    openDetails()

    expect(screen.getByTestId('provenance-formula')).toHaveTextContent('a * b')
  })

  // Said once, in the status; a result line saying it again would repeat the badge.
  it('says there is no unit once, when the result is unitless', () => {
    renderProvenance(PROVENANCE)
    openDetails()

    expect(screen.queryByTestId('provenance-unit')).toBeNull()
    expect(
      screen.getByText('objects.properties.resultNoUnit')
    ).toBeInTheDocument()
  })
})

describe('labelForValueId', () => {
  const properties: DraftProperty[] = [
    { id: 'p1', key: 'height', label: 'Height', values: [{ id: 'val-1' }] },
    { id: 'p2', key: 'width', values: [{ id: 'val-2' }] },
  ]

  it('resolves a value id to its property label', () => {
    expect(labelForValueId(properties, 'val-1')).toBe('Height')
  })

  it('falls back to the key when the property has no label', () => {
    expect(labelForValueId(properties, 'val-2')).toBe('width')
  })

  it('returns undefined for a value outside the draft', () => {
    expect(labelForValueId(properties, 'missing')).toBeUndefined()
  })
})

// The node's four states. Only an explicit `false` is unchecked, and the value's unit decides
// what that means for a total: with one it is left out, without one it counts in the no-unit total.
describe('a result whose unit the node could not check', () => {
  it('marks nothing when the answer says nothing about the unit', () => {
    renderProvenance(PROVENANCE, 'kg')

    expect(screen.queryByTestId('provenance-unit-left-out')).toBeNull()
    expect(screen.queryByTestId('provenance-unit-unchecked')).toBeNull()
  })

  it('marks nothing when the node checked the unit, and says so in the details', () => {
    renderProvenance({ ...PROVENANCE, unitVerified: true }, 'kg')

    expect(screen.queryByTestId('provenance-unit-left-out')).toBeNull()
    expect(screen.queryByTestId('provenance-unit-unchecked')).toBeNull()
    openDetails()
    expect(
      screen.getByText('objects.properties.unitChecked')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('provenance-fix')).toBeNull()
  })

  // Absent means there was nothing to check, which is not the same as checked.
  it('never claims a check the node did not make', () => {
    renderProvenance(PROVENANCE, 'kg')
    openDetails()

    expect(screen.queryByText('objects.properties.unitChecked')).toBeNull()
  })

  it('says a value with a unit is left out of totals, and why', () => {
    renderProvenance({ ...PROVENANCE, unitVerified: false }, 'kg')

    expect(screen.getByTestId('provenance-unit-left-out')).toHaveTextContent(
      'objects.properties.unitNotCounted'
    )
    // The reason is on the row: the reader has to act on it, so it does not wait behind a click.
    expect(screen.getByTestId('provenance-reason')).toHaveTextContent(
      'objects.properties.unitNotCountedShort'
    )
    openDetails()
    expect(
      screen.getByText('objects.properties.unitNotCountedDetail')
    ).toBeInTheDocument()
    expect(screen.getByTestId('provenance-fix')).toHaveTextContent(
      'objects.properties.fixNotCounted'
    )
  })

  // Without a unit it IS counted, so "not counted" would be false, and a reason line would be noise.
  it('marks a number without a unit as "no unit", with no reason line', () => {
    renderProvenance({ ...PROVENANCE, unitVerified: false })

    expect(screen.queryByTestId('provenance-unit-left-out')).toBeNull()
    expect(screen.getByTestId('provenance-unit-unchecked')).toHaveTextContent(
      'objects.properties.noUnit'
    )
    expect(screen.queryByTestId('provenance-reason')).toBeNull()
    openDetails()
    expect(
      screen.getByText('objects.properties.unitNotCheckedDetail')
    ).toBeInTheDocument()
    expect(screen.getByTestId('provenance-fix')).toHaveTextContent(
      'objects.properties.fixNoUnit'
    )
  })

  // An error has no number at all; the error mark already says everything.
  it('leaves an error to the error mark', () => {
    renderProvenance({
      ...PROVENANCE,
      unitVerified: false,
      error: { code: 'domain', detail: 'x' },
    })

    expect(screen.queryByTestId('provenance-unit-left-out')).toBeNull()
    expect(screen.queryByTestId('provenance-unit-unchecked')).toBeNull()
  })

  it('reads the three values of unitVerified as three answers', () => {
    expect(uncheckedState({}, 'kg')).toBeUndefined()
    expect(uncheckedState({ unitVerified: true }, 'kg')).toBeUndefined()
    expect(uncheckedState({ unitVerified: false }, 'kg')).toBe('left-out')
    expect(uncheckedState({ unitVerified: false }, undefined)).toBe('plain')
  })
})

describe('a unit reached through a factor', () => {
  it('says which input was read as a factor, and in what unit', () => {
    renderProvenance(
      {
        ...PROVENANCE,
        unitVerified: true,
        unitCheck: 'factor',
        factorVars: ['a'],
      },
      'kgCO2e'
    )
    openDetails()
    expect(screen.getByTestId('provenance-factor')).toHaveTextContent(
      'objects.formulaEditor.warning.factorNoPer'
    )
  })

  it('says nothing for a unit computed from the inputs', () => {
    renderProvenance({
      ...PROVENANCE,
      unitVerified: true,
      unitCheck: 'computed',
    })
    openDetails()
    expect(screen.queryByTestId('provenance-factor')).toBeNull()
  })
})
