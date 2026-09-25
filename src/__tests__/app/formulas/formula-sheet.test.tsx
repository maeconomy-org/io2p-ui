import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { FormulaDTO } from 'io2p-client'

import { FormulaSheet } from '@/app/formulas/components/formula-sheet'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const createMutate = vi.fn()
vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useCreate: () => ({ mutateAsync: createMutate, isPending: false }),
  }),
  useConstants: () => ({
    useList: () => ({
      data: { data: [{ id: 'c1', name: 'co2_factor' }] },
    }),
  }),
  useUnits: () => ({
    data: [
      {
        symbol: 'kg',
        dimension: 'mass',
        aliases: [],
        canonical: true,
        toCanonical: 1,
      },
      {
        symbol: 'J',
        dimension: 'energy',
        aliases: [],
        canonical: false,
        toCanonical: 1 / 3_600_000,
      },
    ],
    isFetching: false,
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

const FORMULA = {
  id: 'f-1',
  name: 'Area',
  expression: 'l * w',
  variables: ['l', 'w'],
  system: false,
  currentVersion: 1,
  createdBy: 'u1',
  createdAt: 1,
  updatedAt: 1,
  deleted: false,
} as FormulaDTO

const nameInput = () => screen.getByLabelText('formulas.name')
const expressionInput = () => screen.getByLabelText('formulas.expression')

describe('FormulaSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMutate.mockResolvedValue({ id: 'new-1' })
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb()
      return 0
    })
  })

  it('opens empty in create mode', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)

    expect(screen.getByText('formulas.createTitle')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('')
    expect(expressionInput()).toHaveValue('')
  })

  it('prefills from the source when duplicating', () => {
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        mode="duplicate"
        formula={FORMULA}
      />
    )

    expect(screen.getByText('formulas.duplicateTitle')).toBeInTheDocument()
    expect(expressionInput()).toHaveValue('l * w')
  })

  it('records copiedFrom, so the lineage of an "edit" survives', async () => {
    // A formula is immutable: duplicating IS the edit, and the copy has to say what it came from.
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        mode="duplicate"
        formula={FORMULA}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({
        body: expect.objectContaining({ copiedFrom: 'f-1' }),
      })
    )
  })

  it('does not send copiedFrom for a fresh create', async () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(nameInput(), { target: { value: 'Volume' } })
    fireEvent.change(expressionInput(), { target: { value: 'l * w * h' } })
    fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].body).not.toHaveProperty('copiedFrom')
  })

  it('omits unit when none was declared', async () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(nameInput(), { target: { value: 'Volume' } })
    fireEvent.change(expressionInput(), { target: { value: 'l * w * h' } })
    fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].body).not.toHaveProperty('unit')
  })

  // A copy that dropped the declaration would send its results back to the unitless bucket — the
  // same silent exclusion the declaration exists to prevent, one generation removed.
  it('carries the declared unit into a duplicate', async () => {
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        mode="duplicate"
        formula={{ ...FORMULA, unit: 'kg' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].body.unit).toBe('kg')
  })

  it('sends correctionOf for a correction, and not copiedFrom', async () => {
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        mode="correction"
        formula={FORMULA}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'formulas.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const body = createMutate.mock.calls[0][0].body
    expect(body.correctionOf).toBe(FORMULA.id)
    // The node defaults `copiedFrom` from `correctionOf` — a correction IS lineage.
    expect(body).not.toHaveProperty('copiedFrom')
  })

  it('warns when viewing a formula that has been corrected', () => {
    render(
      <FormulaSheet
        open
        onOpenChange={vi.fn()}
        mode="view"
        formula={{ ...FORMULA, supersededBy: 'f-2' }}
      />
    )
    expect(screen.getByText('formulas.supersededWarning')).toBeInTheDocument()
  })

  it('has no description or authored version field', () => {
    // Neither exists on FormulaDTO; the legacy sheet collected both and dropped them on the floor.
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)

    expect(screen.queryByLabelText('formulas.description')).toBeNull()
    expect(screen.queryByLabelText('formulas.version')).toBeNull()
  })

  it('blocks saving until the expression parses', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(nameInput(), { target: { value: 'Bad' } })
    fireEvent.change(expressionInput(), { target: { value: 'l *' } })

    // Validity comes from the SAME parser the server uses, so a saveable formula cannot 422.
    expect(
      screen.getByRole('button', { name: 'formulas.create' })
    ).toBeDisabled()
  })

  it('blocks saving a formula the server would reject as non-deterministic', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(nameInput(), { target: { value: 'Dice' } })
    fireEvent.change(expressionInput(), { target: { value: 'random()' } })

    expect(
      screen.getByRole('button', { name: 'formulas.create' })
    ).toBeDisabled()
  })

  it('blocks saving without a name', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(expressionInput(), { target: { value: 'a + b' } })

    expect(
      screen.getByRole('button', { name: 'formulas.create' })
    ).toBeDisabled()
  })

  it('lists the variables the server will derive, before saving', () => {
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(expressionInput(), {
      target: { value: 'volume * co2_factor' },
    })

    expect(screen.getByText('volume')).toBeInTheDocument()
    // Twice on purpose: once as a derived variable, once as an insert chip — `co2_factor` is also
    // an existing constant.
    expect(screen.getAllByText('co2_factor')).toHaveLength(2)
  })

  it('does NOT mark a variable that shares a constant name', () => {
    // A formula references nothing — `co2_factor` is bound at USE time to a constant, a sibling
    // value or neither, exactly like `volume`. Marking it as a constant here asserted a link the
    // model does not have, and read as though the formula had already resolved it.
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(expressionInput(), {
      target: { value: 'volume * co2_factor' },
    })

    expect(screen.queryByText(/formulas.constantShort/)).toBeNull()
  })

  it('excludes builtins from the variable list', () => {
    // Otherwise the sheet would ask the user to bind PI.
    render(<FormulaSheet open onOpenChange={vi.fn()} mode="create" />)
    fireEvent.change(expressionInput(), { target: { value: 'r * PI' } })

    expect(screen.getByText('r')).toBeInTheDocument()
    expect(screen.getByText('formulas.variablesDerived')).toBeInTheDocument()
  })

  it('shows the read-only facts in view mode', () => {
    render(
      <FormulaSheet open onOpenChange={vi.fn()} mode="view" formula={FORMULA} />
    )

    expect(screen.getByText('Area')).toBeInTheDocument()
    expect(screen.getByText('l * w')).toBeInTheDocument()
    // No way to mutate a formula in place.
    expect(screen.queryByLabelText('formulas.name')).toBeNull()
  })
})
