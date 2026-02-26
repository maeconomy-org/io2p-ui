import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ColumnDef, VisibilityState } from '@tanstack/react-table'

import {
  getSelectColumn,
  DataTableColumnToggle,
  DataTable,
} from '@/components/tables/data-table'

// Declare mock fns via vi.hoisted so they're available inside vi.mock factories
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => key),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// ---------- getSelectColumn ----------

describe('getSelectColumn', () => {
  it('should return a column def with id "select"', () => {
    const col = getSelectColumn()
    expect(col.id).toBe('select')
  })

  it('should disable sorting and hiding', () => {
    const col = getSelectColumn()
    expect(col.enableSorting).toBe(false)
    expect(col.enableHiding).toBe(false)
  })

  it('should have a fixed size of 20', () => {
    const col = getSelectColumn()
    expect(col.size).toBe(20)
  })
})

// ---------- DataTableColumnToggle ----------

describe('DataTableColumnToggle', () => {
  const COLUMNS = [
    { id: 'name', labelKey: 'objects.fields.name' },
    { id: 'uuid', labelKey: 'objects.fields.uuid' },
    { id: 'createdAt', labelKey: 'objects.fields.created' },
  ]

  it('should render nothing when columns array is empty', () => {
    const { container } = render(
      <DataTableColumnToggle
        columns={[]}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('should render a trigger button with translated label', () => {
    render(
      <DataTableColumnToggle
        columns={COLUMNS}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />
    )
    expect(screen.getByText('objects.bulk.columns')).toBeInTheDocument()
  })

  it('should render one trigger button per column set', () => {
    render(
      <DataTableColumnToggle
        columns={COLUMNS}
        columnVisibility={{}}
        onColumnVisibilityChange={vi.fn()}
      />
    )
    // The trigger button should exist
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('objects.bulk.columns')
  })
})

// ---------- DataTable ----------

interface TestRow {
  id: string
  name: string
}

const TEST_COLUMNS: ColumnDef<TestRow, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
]

const TEST_DATA: TestRow[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
]

describe('DataTable', () => {
  it('should render rows from data', () => {
    render(
      <DataTable
        columns={TEST_COLUMNS}
        data={TEST_DATA}
        getRowId={(row) => row.id}
      />
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('should render empty state when data is empty', () => {
    render(
      <DataTable
        columns={TEST_COLUMNS}
        data={[]}
        getRowId={(row) => row.id}
        emptyTitle="No data"
        emptyDescription="Nothing to show"
      />
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Nothing to show')).toBeInTheDocument()
  })

  it('should hide columns based on columnVisibility', () => {
    const visibility: VisibilityState = { name: false }

    render(
      <DataTable
        columns={TEST_COLUMNS}
        data={TEST_DATA}
        getRowId={(row) => row.id}
        columnVisibility={visibility}
      />
    )

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('should not render pagination when pagination prop is omitted', () => {
    render(
      <DataTable
        columns={TEST_COLUMNS}
        data={TEST_DATA}
        getRowId={(row) => row.id}
      />
    )

    // Pagination text like "Showing X-Y of Z results" should not appear
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it('should show loading spinner when fetching is true', () => {
    const { container } = render(
      <DataTable
        columns={TEST_COLUMNS}
        data={[]}
        getRowId={(row) => row.id}
        fetching={true}
      />
    )

    // When fetching, a spinner with animate-spin is rendered
    const spinnerElements = container.querySelectorAll('.animate-spin')
    expect(spinnerElements.length).toBeGreaterThan(0)
  })
})
