import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps } from 'react'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { TablePagination } from '@/components/ui/table-pagination'

type Props = ComponentProps<typeof TablePagination>

const base: Props = {
  currentPage: 0,
  totalPages: 51,
  totalElements: 1001,
  pageSize: 20,
  isFirstPage: true,
  isLastPage: false,
  capped: true,
  rowsOnPage: 20,
  onPageChange: () => {},
  onFirst: () => {},
  onPrevious: () => {},
  onNext: () => {},
  onLast: () => {},
}

function ui(props: Partial<Props>, locale: 'en' | 'nl' = 'en') {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : nl}
      timeZone="Europe/Amsterdam"
    >
      <TablePagination {...base} {...props} />
    </NextIntlClientProvider>
  )
}

describe('TablePagination on a capped total', () => {
  it('keeps next on at page 51 of 51+ while the page is full', () => {
    render(ui({ currentPage: 50, isFirstPage: false }))
    expect(screen.getByTestId('page-next')).toBeEnabled()
    expect(screen.getByTestId('page-of')).toHaveTextContent('Page 51 of 51+')
  })

  it('shows no last-page control, because the node does not say which page is last', () => {
    render(ui({ currentPage: 2, isFirstPage: false }))
    expect(screen.queryByTestId('page-last')).toBeNull()
    expect(screen.getByTestId('page-of')).toHaveTextContent('Page 3 of 51+')
  })

  it('shows the page alone once it is past the lower limit', () => {
    render(ui({ currentPage: 59, isFirstPage: false }))
    expect(screen.getByTestId('page-of')).toHaveTextContent(/^Page 60$/)
  })

  it('ends the range at the rows on the page, not at the capped total', () => {
    render(ui({ currentPage: 59, isFirstPage: false }))
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'Showing 1,181-1,200 of 1,000+ results'
    )
  })

  it('formats the capped total for Dutch', () => {
    render(ui({ currentPage: 59, isFirstPage: false }, 'nl'))
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'Toont 1.181-1.200 van 1.000+ resultaten'
    )
  })

  it('offers a page button for the next page, not for the lower limit', () => {
    render(ui({ currentPage: 59, isFirstPage: false }))
    expect(screen.getByTestId('page-number-61')).toBeInTheDocument()
    expect(screen.queryByTestId('page-number-62')).toBeNull()
  })

  it('keeps the bar on a page after the first when no total came back (an error)', () => {
    const onPrevious = vi.fn()
    render(
      ui({
        currentPage: 59,
        totalPages: 0,
        totalElements: 0,
        capped: false,
        rowsOnPage: 0,
        isFirstPage: false,
        isLastPage: true,
        onPrevious,
      })
    )
    fireEvent.click(screen.getByTestId('page-prev'))
    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it('moves focus to previous when next turns off under it', async () => {
    const user = userEvent.setup()
    const { rerender } = render(ui({ currentPage: 61, isFirstPage: false }))
    await user.click(screen.getByTestId('page-next'))
    rerender(
      ui({
        currentPage: 62,
        isFirstPage: false,
        isLastPage: true,
        rowsOnPage: 7,
      })
    )
    expect(screen.getByTestId('page-prev')).toHaveFocus()
  })
})

describe('TablePagination on an exact total', () => {
  it('shows 1001 as the real number and keeps the last-page control', () => {
    render(ui({ capped: false, totalElements: 1001, rowsOnPage: 20 }))
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'Showing 1-20 of 1,001 results'
    )
    expect(screen.getByTestId('page-last')).toBeInTheDocument()
    expect(screen.getByTestId('page-of')).toHaveTextContent('Page 1 of 51')
  })
})

describe('TablePagination for the keyboard and screen readers', () => {
  it('lets Tab reach a page number button', async () => {
    const user = userEvent.setup()
    render(ui({ currentPage: 2, isFirstPage: false }))
    const pageTwo = screen.getByTestId('page-number-2')
    while (document.activeElement !== pageTwo) {
      await user.tab()
      if (document.activeElement === document.body) break
    }
    expect(pageTwo).toHaveFocus()
  })

  it('announces the page line as a status', () => {
    render(ui({ currentPage: 2, isFirstPage: false }))
    expect(screen.getByRole('status')).toHaveTextContent('Page 3 of 51+')
  })
})
