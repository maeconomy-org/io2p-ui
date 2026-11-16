import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import en from '@/messages/en.json'
import { CommandMore, type FetchedPage } from '@/components/ui/command-more'

const page = (rows: number, totalElements: number): FetchedPage => ({
  data: Array.from({ length: rows }),
  page: { totalElements },
})

function footer(pages: FetchedPage[], capped: boolean) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={en}
      timeZone="Europe/Amsterdam"
    >
      <CommandMore pages={pages} capped={capped} />
    </NextIntlClientProvider>
  )
  return screen.getByTestId('command-more')
}

describe('CommandMore on a capped list', () => {
  it('says "of 1,000+" for one capped page', () => {
    expect(footer([page(20, 1001)], true)).toHaveTextContent(
      'Showing the first 20 of 1,000+.'
    )
  })

  it('never adds a capped total into an exact-looking sum', () => {
    const text = footer([page(20, 1001), page(5, 5)], true).textContent
    expect(text).toContain('of 1,000+.')
    expect(text).not.toContain('1006')
  })

  it('shows 1001 on a list the node counts exactly (users) as the real number', () => {
    expect(footer([page(20, 1001)], false)).toHaveTextContent(
      'Showing the first 20 of 1001.'
    )
  })
})
