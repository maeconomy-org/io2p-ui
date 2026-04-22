import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

import { FormulaSheet } from '@/components/formulas/formula-sheet'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const createMutate = vi.fn()
const generateMutate = vi.fn()

vi.mock('@/hooks', () => ({
  useMathFormulas: () => ({
    useCreateFormula: () => ({
      mutateAsync: createMutate,
      isPending: false,
    }),
  }),
}))

vi.mock('@/hooks/api/use-uuid', () => ({
  useUuid: () => ({
    useGenerateUuid: () => ({
      mutateAsync: generateMutate,
      isPending: false,
    }),
  }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}))

describe('FormulaSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateMutate.mockResolvedValue('new-uuid-123')
    createMutate.mockResolvedValue({ uuid: 'new-uuid-123' })
  })

  it('renders create title/description when not editing', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} />)
    expect(screen.getByText('formulas.createTitle')).toBeInTheDocument()
    expect(screen.getByText('formulas.createDescription')).toBeInTheDocument()
  })

  it('prefills the form when editing an existing formula', () => {
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        isEditing
        formula={
          {
            uuid: 'f-1',
            name: 'Area',
            expression: 'l * w',
            description: 'area formula',
            version: '1.0',
          } as any
        }
      />
    )
    expect(screen.getByText('formulas.editTitle')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Area')).toBeInTheDocument()
    expect(screen.getByDisplayValue('l * w')).toBeInTheDocument()
  })

  it('shows syntax error on invalid expressions and valid state on good ones', async () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} />)
    const [, expressionInput] = screen.getAllByRole('textbox')

    fireEvent.change(expressionInput, { target: { value: 'a +' } })
    await waitFor(() =>
      expect(expressionInput).toHaveClass('border-destructive')
    )

    fireEvent.change(expressionInput, { target: { value: 'a + b' } })
    await waitFor(() =>
      expect(screen.getByText('formulas.validSyntax')).toBeInTheDocument()
    )
  })

  it('generates a uuid and creates the formula on submit', async () => {
    const onOpenChange = vi.fn()
    render(<FormulaSheet open onOpenChange={onOpenChange} />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'My Formula' } })
    fireEvent.change(inputs[1], { target: { value: 'a + b' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))
    })

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(generateMutate).toHaveBeenCalled()
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'new-uuid-123',
        name: 'My Formula',
        expression: 'a + b',
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith('formulas.created')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('reuses existing uuid when editing (no generate call)', async () => {
    const onOpenChange = vi.fn()
    render(
      <FormulaSheet
        open
        onOpenChange={onOpenChange}
        isEditing
        formula={
          {
            uuid: 'existing-uuid',
            name: 'Area',
            expression: 'l * w',
          } as any
        }
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'formulas.update' }))
    })

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(generateMutate).not.toHaveBeenCalled()
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'existing-uuid', name: 'Area' })
    )
    expect(toastSuccess).toHaveBeenCalledWith('formulas.updated')
  })

  it('toasts an error when the create mutation rejects', async () => {
    createMutate.mockRejectedValueOnce(new Error('boom'))
    render(<FormulaSheet open onOpenChange={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'X' } })
    fireEvent.change(inputs[1], { target: { value: 'a + b' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))
    })

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('formulas.saveFailed')
    )
  })
})
