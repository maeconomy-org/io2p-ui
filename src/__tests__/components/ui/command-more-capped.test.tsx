import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import en from '@/messages/en.json'
import { CommandMore, type FetchedPage } from '@/components/ui/command-more'

const page = (
  rows: number,
  totalElements: number,
  capped?: boolean
): FetchedPage => ({
  data: Array.from({ length: rows }),
  page: { totalElements },
  capped,
})

function footer(pages: FetchedPage[]) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      timeZone="Europe/Amsterdam"
    >
      <CommandMore pages={pages} />
    </NextIntlClientProvider>
  )
  return screen.getByTestId('command-more')
}

describe('CommandMore on a capped list', () => {
  it('says "of 1,000+" for one capped page', () => {
    expect(footer([page(20, 1001, true)])).toHaveTextContent(
      'Showing the first 20 of 1,000+.'
    )
  })

  it('never adds a capped total into an exact-looking sum', () => {
    const text = footer([page(20, 1001, true), page(5, 5, true)]).textContent
    expect(text).toContain('of 1,000+.')
    expect(text).not.toContain('1006')
  })

  it('shows 1001 on a list the node counts exactly (users) as the real number', () => {
    expect(footer([page(20, 1001)])).toHaveTextContent(
      'Showing the first 20 of 1001.'
    )
  })
})
