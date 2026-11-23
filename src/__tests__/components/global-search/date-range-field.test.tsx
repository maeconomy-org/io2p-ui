import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { DateRangeField } from '@/components/global-search/date-range-field'
import en from '@/messages/en.json'

// The real formatter, in UTC as the app runs it; the tests run in Europe/Amsterdam.
const show = (from: string, to: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <span id="label">Created</span>
      <DateRangeField
        id="created"
        field="createdFrom"
        labelledBy="label"
        from={from}
        to={to}
        onChange={() => {}}
      />
    </NextIntlClientProvider>
  )

describe('DateRangeField', () => {
  it('shows the days it holds, not the day before', () => {
    show('2026-01-01', '2026-12-31')
    expect(screen.getByRole('button')).toHaveTextContent(
      'Jan 1, 2026 – Dec 31, 2026'
    )
  })

  it('shows an open range from its first day', () => {
    show('2026-03-01', '')
    expect(screen.getByRole('button')).toHaveTextContent('From Mar 1, 2026')
  })

  it('shows one day once', () => {
    show('2026-03-01', '2026-03-01')
    expect(screen.getByRole('button')).toHaveTextContent(/^Mar 1, 2026$/)
  })
})
