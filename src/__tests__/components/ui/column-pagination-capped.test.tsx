import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

import en from '@/messages/en.json'
import { ColumnPagination } from '@/components/ui/column-pagination'

type Props = ComponentProps<typeof ColumnPagination>

const base: Props = {
  currentPage: 51,
  totalPages: 51,
  totalItems: 1001,
  capped: true,
  isLastPage: false,
  onPageChange: () => {},
}

function ui(props: Partial<Props>) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={en}
      timeZone="Europe/Amsterdam"
    >
      <ColumnPagination {...base} {...props} />
    </NextIntlClientProvider>
  )
}

function typePage(value: string) {
  const input = screen.getByLabelText('Page')
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('ColumnPagination on a capped total', () => {
  it('reads "/ 51+" and keeps next on while the page is full', () => {
    render(ui({}))
    expect(screen.getByText('/ 51+')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('shows no last-page control', () => {
    render(ui({}))
    expect(screen.queryByRole('button', { name: 'Last page' })).toBeNull()
  })

  it('accepts a typed page past the lower limit', () => {
    const onPageChange = vi.fn()
    render(ui({ onPageChange }))
    typePage('52')
    expect(onPageChange).toHaveBeenCalledWith(52)
  })

  it('turns next off on the short page that ends the list', () => {
    render(ui({ currentPage: 53, isLastPage: true }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})

describe('ColumnPagination on an exact total', () => {
  it('refuses a typed page past the last one and keeps the last-page control', () => {
    const onPageChange = vi.fn()
    render(
      ui({
        capped: false,
        currentPage: 1,
        totalPages: 5,
        totalItems: 100,
        isLastPage: undefined,
        onPageChange,
      })
    )
    typePage('6')
    expect(onPageChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Page')).toHaveValue(1)
    expect(screen.getByRole('button', { name: 'Last page' })).toBeEnabled()
  })
})

describe('ColumnPagination around the current page', () => {
  it('shows the new page in the box when the page moves from outside', () => {
    const { rerender } = render(ui({ currentPage: 60 }))
    expect(screen.getByLabelText('Page')).toHaveValue(60)
    rerender(ui({ currentPage: 1 }))
    expect(screen.getByLabelText('Page')).toHaveValue(1)
  })

  it('keeps first and previous on a page after the first when no total came back', () => {
    const onPageChange = vi.fn()
    render(
      ui({
        currentPage: 60,
        totalPages: 1,
        totalItems: 0,
        capped: false,
        isLastPage: true,
        onPageChange,
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(59)
    expect(screen.getByRole('button', { name: 'First page' })).toBeEnabled()
  })
})
