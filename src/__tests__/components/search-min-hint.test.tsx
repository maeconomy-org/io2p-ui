import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { SearchMinHint } from '@/components/search-min-hint'
import en from '@/messages/en.json'

const renderHint = (query: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SearchMinHint query={query} />
    </NextIntlClientProvider>
  )

describe('SearchMinHint', () => {
  it('asks for more characters when one is typed', () => {
    renderHint(' a ')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Type 2 or more characters to search'
    )
  })

  it.each([[''], ['   '], ['ab']])('says nothing for %j', (query) => {
    renderHint(query)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
