import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ProcessMaterialList } from '@/components/processes/sheets/process-material-list'
import type { ProcessMaterial } from '@/components/processes/utils'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const material = (
  overrides: Partial<ProcessMaterial> = {}
): ProcessMaterial => ({
  object: { uuid: overrides.object?.uuid ?? 'm-1', name: 'Steel' } as any,
  quantity: 10,
  unit: 'kg',
  ...overrides,
})

describe('ProcessMaterialList', () => {
  it('renders the empty state when no materials are provided', () => {
    render(
      <ProcessMaterialList
        type="input"
        materials={[]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('processes.form.empty')).toBeInTheDocument()
    expect(
      screen.getByText('processes.form.inputMaterials')
    ).toBeInTheDocument()
  })

  it('renders material rows with quantity, unit, and metadata badges', () => {
    render(
      <ProcessMaterialList
        type="output"
        materials={[
          material({
            metadata: {
              outputLifecycleStage: 'manufacturing',
              categoryCode: 'CAT-A',
            },
          }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Steel')).toBeInTheDocument()
    expect(screen.getByText(/10 kg/)).toBeInTheDocument()
    expect(screen.getByText('manufacturing')).toBeInTheDocument()
    expect(screen.getByText('CAT-A')).toBeInTheDocument()
  })

  it('uses the input lifecycle field when type=input', () => {
    render(
      <ProcessMaterialList
        type="input"
        materials={[
          material({
            metadata: { inputLifecycleStage: 'rawMaterials' },
          }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('rawMaterials')).toBeInTheDocument()
  })

  it('invokes onAdd, onEdit, and onRemove with the right material', () => {
    const onAdd = vi.fn()
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const m = material()
    render(
      <ProcessMaterialList
        type="input"
        materials={[m]}
        onAdd={onAdd}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    )

    fireEvent.click(screen.getByText('processes.form.add'))
    expect(onAdd).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('processes.form.edit'))
    expect(onEdit).toHaveBeenCalledWith(m)

    // Remove button uses an icon — find it by being the second button in the row
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(onRemove).toHaveBeenCalledWith(m)
  })

  it('shows a validation error message when error prop is passed', () => {
    render(
      <ProcessMaterialList
        type="input"
        materials={[]}
        error="At least one input is required"
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(
      screen.getByText('At least one input is required')
    ).toBeInTheDocument()
  })

  it('prefers the generic lifecycleStage over the type-specific one', () => {
    render(
      <ProcessMaterialList
        type="output"
        materials={[
          material({
            metadata: {
              lifecycleStage: 'use',
              outputLifecycleStage: 'manufacturing',
            },
          }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('use')).toBeInTheDocument()
    expect(screen.queryByText('manufacturing')).not.toBeInTheDocument()
  })
})
