import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { FormulaEditor } from '@/components/properties/formula-editor'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const availableProperties = [
  { uuid: 'p1::0', key: 'length', label: 'Length', value: '10' },
  { uuid: 'p2::0', key: 'width', label: 'Width', value: '5' },
]

describe('FormulaEditor', () => {
  it('renders expression input and notifies parent of initial onChange', async () => {
    const onChange = vi.fn()
    render(
      <FormulaEditor
        availableProperties={availableProperties}
        onChange={onChange}
      />
    )
    expect(screen.getByTestId('formula-expression-input')).toBeInTheDocument()
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const call = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(call).toMatchObject({
      formula: '',
      variableMapping: {},
      isValid: false,
    })
  })

  it('detects variables when a formula is typed and renders mapping row', async () => {
    render(<FormulaEditor availableProperties={availableProperties} />)
    const input = screen.getByTestId(
      'formula-expression-input'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'x + y' } })

    expect(
      await screen.findByTestId('formula-variable-mapping-row-x')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('formula-variable-mapping-row-y')
    ).toBeInTheDocument()
  })

  it('initializes with initialFormula and initialMapping, resolving values', async () => {
    const onChange = vi.fn()
    render(
      <FormulaEditor
        availableProperties={availableProperties}
        initialFormula="a + b"
        initialMapping={{
          a: { propertyKey: 'length', propertyUuid: 'p1::0' },
          b: { propertyKey: 'width', propertyUuid: 'p2::0' },
        }}
        onChange={onChange}
      />
    )

    // Once resolved, evaluation returns 15
    await waitFor(() => {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]
      expect(last?.result).toBe(15)
      expect(last?.isValid).toBe(true)
    })
    expect(screen.getByTestId('formula-result-preview')).toHaveTextContent('15')
  })

  it('exposes the template dropdown when not readOnly', () => {
    render(<FormulaEditor availableProperties={availableProperties} />)
    expect(screen.getByTestId('formula-quick-templates')).toBeInTheDocument()
  })

  it('hides the template dropdown when readOnlyExpression is true', () => {
    render(
      <FormulaEditor
        availableProperties={availableProperties}
        readOnlyExpression
      />
    )
    expect(
      screen.queryByTestId('formula-quick-templates')
    ).not.toBeInTheDocument()
    expect(
      (screen.getByTestId('formula-expression-input') as HTMLInputElement)
        .disabled
    ).toBe(true)
  })

  it('hides the expression input entirely when hideExpression is true', () => {
    render(
      <FormulaEditor
        availableProperties={availableProperties}
        initialFormula="x + y"
        hideExpression
      />
    )
    expect(
      screen.queryByTestId('formula-expression-input')
    ).not.toBeInTheDocument()
    // Variable mapping should still render
    expect(screen.getByTestId('formula-variable-mapping')).toBeInTheDocument()
  })
})
