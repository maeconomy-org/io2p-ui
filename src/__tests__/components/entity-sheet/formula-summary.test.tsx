import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useGet: () => ({
      data: { name: 'double', expression: 'x * 2', variables: ['x'] },
    }),
  }),
  useConstants: () => ({ useByIds: () => new Map() }),
}))

import { FormulaSummary } from '@/components/entity-sheet/fields/formula-value-editor'

describe('a template formula', () => {
  // Nothing is calculated in a template, so the equation names the property each variable reads.
  it('reads as its equation with the bound properties named', () => {
    render(
      <FormulaSummary
        calc={{ formulaId: 'f-1', args: [{ var: 'x', ref: 'r-1' }] }}
        labelForValue={(ref) => (ref === 'r-1' ? 'Width' : undefined)}
      />
    )

    expect(screen.getByTestId('formula-summary')).toHaveTextContent(
      '= Width × 2'
    )
    expect(screen.getByText('double')).toBeInTheDocument()
    expect(screen.getByText('templates.formulaInert')).toBeInTheDocument()
  })

  it('keeps an unbound variable by its own name', () => {
    render(<FormulaSummary calc={{ formulaId: 'f-1', args: [] }} />)
    expect(screen.getByTestId('formula-summary')).toHaveTextContent('= x × 2')
  })
})
