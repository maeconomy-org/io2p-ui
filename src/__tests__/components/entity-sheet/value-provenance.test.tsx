import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  ValueProvenanceDisplay,
  labelForValueId,
} from '@/components/entity-sheet/fields/value-provenance'
import type { DraftProperty, ValueProvenance } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

function renderProvenance(provenance: ValueProvenance) {
  return render(
    React.createElement(ValueProvenanceDisplay, {
      provenance,
      labelForValue: (id: string) => (id === 'val-1' ? 'Height' : undefined),
    })
  )
}

describe('ValueProvenanceDisplay', () => {
  it('keeps the trace collapsed until asked', () => {
    renderProvenance(PROVENANCE)

    expect(screen.queryByText('a * b')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'objects.properties.showFormula' })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('reveals the expression and what each variable was bound to', () => {
    renderProvenance(PROVENANCE)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('a * b')).toBeInTheDocument()
    // A sibling value is named by id in the trace; the reader needs the property it belongs to.
    expect(screen.getByText('a = Height (3)')).toBeInTheDocument()
    // Constant names aren't in the projection — show the number, don't invent a name.
    expect(screen.getByText('b (0.5)')).toBeInTheDocument()
  })

  // A failed formula used to render as an ordinary empty value: nothing said it had broken.
  it('surfaces an evaluation error with an icon and text, not colour alone', () => {
    renderProvenance({
      ...PROVENANCE,
      error: { code: 'arg-not-numeric', detail: 'Height is not a number' },
    })

    expect(
      screen.getByText('objects.properties.formulaError')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Height is not a number')).toBeInTheDocument()
  })

  it('falls back to the error code when there is no detail', () => {
    renderProvenance({
      ...PROVENANCE,
      error: { code: 'cycle', detail: '' },
    })
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('cycle')).toBeInTheDocument()
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
