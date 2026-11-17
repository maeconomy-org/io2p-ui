import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { Page } from 'io2p-client'

import en from '@/messages/en.json'
import { EntityTable } from '@/components/entity-list/entity-table'

interface Row {
  id: string
}

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'id', header: 'Id', cell: ({ row }) => row.original.id },
]

/** A page as the node sends it: `totalPages = ceil(total / size)`, 1001 on a capped list. */
function answered(
  number: number,
  rows: number,
  totalElements: number,
  size = 20
): Page<Row> {
  return {
    data: Array.from({ length: rows }, (_, i) => ({ id: `r-${number}-${i}` })),
    page: {
      number,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    },
  }
}

function renderTable(props: {
  page?: Page<Row>
  requestedPage?: number
  capped?: boolean
  error?: unknown
  fetching?: boolean
  onPageChange: (page: number) => void
}) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      timeZone="Europe/Amsterdam"
    >
      <EntityTable<Row>
        columns={columns}
        getRowId={(r) => r.id}
        pageSize={20}
        capped={props.capped ?? true}
        page={props.page}
        requestedPage={props.requestedPage}
        error={props.error ?? null}
        fetching={props.fetching}
        onPageChange={props.onPageChange}
      />
    </NextIntlClientProvider>
  )
}

describe('EntityTable on a capped list', () => {
  it('asks for page 52 when next is pressed on a full page 51', () => {
    const onPageChange = vi.fn()
    renderTable({ page: answered(51, 20, 1001), onPageChange })
    fireEvent.click(screen.getByTestId('page-next'))
    expect(onPageChange).toHaveBeenCalledWith(52)
  })

  it('asks for page 52 once, however often next is pressed while it loads', () => {
    // keepPreviousData: the table still shows page 51 until 52 lands.
    const onPageChange = vi.fn()
    renderTable({ page: answered(51, 20, 1001), fetching: true, onPageChange })
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('page-next'))
    }
    expect(onPageChange.mock.calls).toEqual([[52]])
  })

  it('asks again for a page once the list is idle, so a retry is possible', () => {
    const onPageChange = vi.fn()
    renderTable({ page: answered(51, 20, 1001), onPageChange })
    fireEvent.click(screen.getByTestId('page-next'))
    fireEvent.click(screen.getByTestId('page-next'))
    expect(onPageChange.mock.calls).toEqual([[52], [52]])
  })

  it('says there are no more rows on an empty page after the end', () => {
    renderTable({ page: answered(60, 0, 1001), onPageChange: vi.fn() })
    expect(screen.getByText('No more rows')).toBeInTheDocument()
    expect(screen.getByTestId('page-prev')).toBeEnabled()
    expect(screen.getByTestId('page-next')).toBeDisabled()
  })

  it('goes back to the last real page from an empty page 60 when the total is now exact', () => {
    // Rows were deleted while the user paged: the node counted 900 for the empty page.
    const onPageChange = vi.fn()
    renderTable({ page: answered(60, 0, 900), onPageChange })
    expect(screen.getByText('No more rows')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('page-prev'))
    expect(onPageChange).toHaveBeenCalledWith(45)
  })

  it('keeps previous working on page 60 when the page did not load', () => {
    const onPageChange = vi.fn()
    renderTable({
      page: undefined,
      requestedPage: 60,
      error: new Error('list too slow'),
      onPageChange,
    })
    fireEvent.click(screen.getByTestId('page-prev'))
    expect(onPageChange).toHaveBeenCalledWith(59)
    fireEvent.click(screen.getByTestId('page-first'))
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(screen.getByTestId('page-of')).toHaveTextContent(/^Page 60$/)
  })

  it('offers the last real page from an empty page 60 when the total is now exact', () => {
    const onPageChange = vi.fn()
    renderTable({ page: answered(60, 0, 900), onPageChange })
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 45' }))
    expect(onPageChange).toHaveBeenCalledWith(45)
  })

  it('offers no page to go to from an empty page past a capped total', () => {
    renderTable({ page: answered(60, 0, 1001), onPageChange: vi.fn() })
    expect(screen.queryByTestId('page-go-last')).toBeNull()
  })

  it.each([1, 51])('shows no last-page control on page %i', (n) => {
    renderTable({ page: answered(n, 20, 1001), onPageChange: vi.fn() })
    expect(screen.queryByTestId('page-last')).toBeNull()
    expect(screen.getByTestId('page-next')).toBeEnabled()
  })
})

describe('EntityTable on a list the node counts exactly', () => {
  it('stops next at the last page', () => {
    renderTable({
      page: answered(51, 1, 1001),
      capped: false,
      onPageChange: vi.fn(),
    })
    expect(screen.getByTestId('page-next')).toBeDisabled()
  })

  it('jumps to the exact last page from the last-page control', () => {
    const onPageChange = vi.fn()
    renderTable({ page: answered(50, 20, 1001), capped: false, onPageChange })
    fireEvent.click(screen.getByTestId('page-last'))
    expect(onPageChange).toHaveBeenCalledWith(51)
  })
})
