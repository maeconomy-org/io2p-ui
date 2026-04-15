import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { PropertyItem } from '@/components/properties/property-item'
import type { Property, FormulaData } from '@/components/properties/types'

// Mock next-intl
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string, params?: any) => {
    if (params?.count !== undefined) return `${params.count} values`
    return key
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// Mock child components that have complex dependencies
vi.mock('@/components/object-sheets/components/file-display', () => ({
  FileList: ({ files }: { files: any[] }) => (
    <div data-testid="file-list">{files.length} files</div>
  ),
}))

vi.mock('@/components/properties/formula-display', () => ({
  FormulaDisplay: ({ formula, result }: { formula: string; result: any }) => (
    <div data-testid="formula-display">
      {formula} = {result}
    </div>
  ),
}))

vi.mock('@/components/properties/formula-editor', () => ({
  FormulaEditor: () => <div data-testid="formula-editor" />,
}))

vi.mock('@/components/properties/formula-picker', () => ({
  FormulaPicker: () => <div data-testid="formula-picker" />,
}))

vi.mock('@/components/properties/value-mode-toggle', () => ({
  ValueModeToggle: ({
    onTextMode,
    onFormulaMode,
  }: {
    onTextMode: () => void
    onFormulaMode: () => void
  }) => (
    <div data-testid="value-mode-toggle">
      <button data-testid="text-mode-btn" onClick={onTextMode}>
        Text
      </button>
      <button data-testid="formula-mode-btn" onClick={onFormulaMode}>
        Formula
      </button>
    </div>
  ),
}))

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>()
  return {
    ...actual,
    formatNumericValue: (v: any) => v?.toString() ?? '',
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    uuid: 'prop-1',
    key: 'Width',
    label: 'Width',
    values: [{ uuid: 'val-1', value: '42' }],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PropertyItem', () => {
  describe('collapsed state', () => {
    it('renders property name and summary value', () => {
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('Width')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('shows value count when multiple values exist', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              { uuid: 'v1', value: '10' },
              { uuid: 'v2', value: '20' },
            ],
          })}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('2 values')).toBeInTheDocument()
    })

    it('shows formula badge when a value has a formula', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              {
                uuid: 'v1',
                value: '100',
                formulaData: {
                  formula: 'a + b',
                  result: 100,
                },
              },
            ],
          })}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('fx')).toBeInTheDocument()
    })

    it('does not show expanded content', () => {
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(
        screen.queryByText('objects.propertyValues')
      ).not.toBeInTheDocument()
    })

    it('calls onToggle when header is clicked', () => {
      const onToggle = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={false}
          onToggle={onToggle}
        />
      )

      fireEvent.click(screen.getByTestId('property-header-prop-1'))
      expect(onToggle).toHaveBeenCalledOnce()
    })
  })

  describe('expanded state — display mode', () => {
    it('shows value in expanded view', () => {
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      // Value appears in both summary and expanded view
      expect(screen.getAllByText('42')).toHaveLength(2)
    })

    it('shows values header when multiple values', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              { uuid: 'v1', value: '10' },
              { uuid: 'v2', value: '20' },
            ],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('objects.propertyValues')).toBeInTheDocument()
    })

    it('renders FormulaDisplay for formula values', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              {
                uuid: 'v1',
                value: '100',
                formulaData: {
                  formula: 'a + b',
                  result: 100,
                  resolvedExpression: '50 + 50',
                },
              },
            ],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByTestId('formula-display')).toBeInTheDocument()
    })

    it('renders file list when property has files', () => {
      render(
        <PropertyItem
          property={makeProperty({
            files: [{ fileName: 'doc.pdf' } as any],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByTestId('file-list')).toBeInTheDocument()
    })

    it('shows attach buttons when onAttachFile is provided', () => {
      const onAttachFile = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          onAttachFile={onAttachFile}
        />
      )

      // Both property-level and value-level attach are paperclip icons
      const paperclipButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-paperclip'))
      // One for property, one for value
      expect(paperclipButtons).toHaveLength(2)
    })

    it('does not show delete button in display mode', () => {
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      expect(
        screen.queryByTestId('property-delete-prop-1')
      ).not.toBeInTheDocument()
    })
  })

  describe('expanded state — edit mode', () => {
    it('shows name input field', () => {
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onNameChange={vi.fn()}
        />
      )

      const input = screen.getByDisplayValue('Width')
      expect(input).toBeInTheDocument()
    })

    it('calls onNameChange when name is edited', () => {
      const onNameChange = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onNameChange={onNameChange}
        />
      )

      const input = screen.getByDisplayValue('Width')
      fireEvent.change(input, { target: { value: 'Height' } })
      expect(onNameChange).toHaveBeenCalledWith('Height')
    })

    it('calls onValueChange when value is edited', () => {
      const onValueChange = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onValueChange={onValueChange}
        />
      )

      const valueInput = screen.getByDisplayValue('42')
      fireEvent.change(valueInput, { target: { value: '99' } })
      expect(onValueChange).toHaveBeenCalledWith(0, '99')
    })

    it('calls onAddValue when add button is clicked', () => {
      const onAddValue = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onAddValue={onAddValue}
        />
      )

      fireEvent.click(screen.getByTestId('property-add-value-prop-1'))
      expect(onAddValue).toHaveBeenCalledOnce()
    })

    it('calls onRemoveValue when value remove button is clicked', () => {
      const onRemoveValue = vi.fn()
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              { uuid: 'val-1', value: '42' },
              { uuid: 'val-2', value: '99' },
            ],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onRemoveValue={onRemoveValue}
        />
      )

      // The X button in the value item
      const xButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('.lucide-x'))
      expect(xButtons.length).toBeGreaterThan(0)
      fireEvent.click(xButtons[0])
      expect(onRemoveValue).toHaveBeenCalledWith(0)
    })

    it('shows delete button and calls onRemove directly for empty property', () => {
      const onRemove = vi.fn()
      render(
        <PropertyItem
          property={makeProperty({ key: '', values: [] })}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onRemove={onRemove}
        />
      )

      const deleteBtn = screen.getByTestId('property-delete-prop-1')
      fireEvent.click(deleteBtn)
      expect(onRemove).toHaveBeenCalledOnce()
    })

    it('requires confirmation before deleting property with data', () => {
      const onRemove = vi.fn()
      render(
        <PropertyItem
          property={makeProperty()}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onRemove={onRemove}
        />
      )

      const deleteBtn = screen.getByTestId('property-delete-prop-1')
      fireEvent.click(deleteBtn)
      // First click shows confirm text, does not delete
      expect(onRemove).not.toHaveBeenCalled()
      expect(screen.getByText('common.confirm')).toBeInTheDocument()

      // Second click confirms the delete
      fireEvent.click(screen.getByTestId('property-delete-prop-1'))
      expect(onRemove).toHaveBeenCalledOnce()
    })

    it('shows ValueModeToggle for each value', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              { uuid: 'v1', value: '10' },
              { uuid: 'v2', value: '20' },
            ],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onValueChange={vi.fn()}
        />
      )

      expect(screen.getAllByTestId('value-mode-toggle')).toHaveLength(2)
    })
  })

  describe('empty states', () => {
    it('shows placeholder when property key is empty', () => {
      render(
        <PropertyItem
          property={makeProperty({ key: '', label: '' })}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(
        screen.getByText('objects.propertyNamePlaceholder')
      ).toBeInTheDocument()
    })

    it('shows no values message when values array is empty', () => {
      render(
        <PropertyItem
          property={makeProperty({ values: [] })}
          isExpanded={true}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByText('objects.noValues')).toBeInTheDocument()
    })
  })

  describe('data-testid attributes', () => {
    it('uses uuid for test IDs when available', () => {
      render(
        <PropertyItem
          property={makeProperty({ uuid: 'abc-123' })}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onRemove={vi.fn()}
          onAddValue={vi.fn()}
        />
      )

      expect(screen.getByTestId('property-item-abc-123')).toBeInTheDocument()
      expect(screen.getByTestId('property-header-abc-123')).toBeInTheDocument()
      expect(screen.getByTestId('property-delete-abc-123')).toBeInTheDocument()
      expect(
        screen.getByTestId('property-add-value-abc-123')
      ).toBeInTheDocument()
    })

    it('uses _tempId for test IDs when uuid is not available', () => {
      render(
        <PropertyItem
          property={makeProperty({
            uuid: undefined,
            _tempId: 'temp_123',
          })}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      expect(screen.getByTestId('property-item-temp_123')).toBeInTheDocument()
    })
  })

  describe('formula integration', () => {
    it('shows formula result in collapsed summary', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              {
                uuid: 'v1',
                value: '150',
                formulaData: {
                  formula: 'a + b',
                  result: 150,
                },
              },
            ],
          })}
          isExpanded={false}
          onToggle={vi.fn()}
        />
      )

      // Summary shows "= 150" for formula values
      expect(screen.getByText('= 150')).toBeInTheDocument()
    })

    it('shows FormulaPicker in edit mode when formula mode is active', () => {
      render(
        <PropertyItem
          property={makeProperty({
            values: [
              {
                uuid: 'v1',
                value: '',
                formulaData: {
                  formula: 'x + y',
                  formulaUuid: 'f1',
                  result: null,
                },
              },
            ],
          })}
          isExpanded={true}
          onToggle={vi.fn()}
          isEditable
          onValueChange={vi.fn()}
          onValueFormulaChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('formula-picker')).toBeInTheDocument()
    })
  })
})
