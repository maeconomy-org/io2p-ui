import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { SearchMinHint } from '@/components/search-min-hint'
import type { SearchKind } from '@/lib/search-text'
import en from '@/messages/en.json'
import nl from '@/messages/nl.json'

const NINE_WORDS = 'a1 b2 c3 d4 e5 f6 g7 h8 i9'

const renderHint = (query: string, kind: SearchKind, locale = 'en') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'nl' ? nl : en}
    >
      <SearchMinHint query={query} kind={kind} id="hint" />
    </NextIntlClientProvider>
  )

describe('SearchMinHint', () => {
  it('asks for a longer word on a word list', () => {
    renderHint(' a b c ', 'words')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Type a word of 2 or more characters to search'
    )
  })

  it('asks for more characters on a substring list', () => {
    renderHint(' a ', 'substring')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Type 2 or more characters to search'
    )
  })

  it('asks for fewer words past 8', () => {
    renderHint(NINE_WORDS, 'words')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Use at most 8 different words to search'
    )
  })

  it('says it in Dutch', () => {
    renderHint(NINE_WORDS, 'words', 'nl')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Gebruik maximaal 8 verschillende woorden om te zoeken'
    )
  })

  it.each([
    ['', 'words'],
    ['   ', 'words'],
    ['ab', 'words'],
    ['a bc', 'words'],
    [NINE_WORDS, 'substring'],
  ] as const)('says nothing for %j on a %s list', (query, kind) => {
    renderHint(query, kind)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('carries the id an input points to', () => {
    renderHint('a', 'words')
    expect(screen.getByRole('status')).toHaveAttribute('id', 'hint')
  })
})
