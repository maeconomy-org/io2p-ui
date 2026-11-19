import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'
import { useFormatTotal } from '@/hooks/ui/use-format-total'

function formatIn(locale: 'en' | 'nl') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : nl}
      timeZone="Europe/Amsterdam"
    >
      {children}
    </NextIntlClientProvider>
  )
  return renderHook(() => useFormatTotal(), { wrapper }).result.current
}

describe('useFormatTotal', () => {
  it('shows a capped total as "1,000+" in en and "1.000+" in nl', () => {
    expect(formatIn('en').text(1001, true)).toBe('1,000+')
    expect(formatIn('nl').text(1001, true)).toBe('1.000+')
  })

  it('says "more than 1,000" to a screen reader, in both locales', () => {
    expect(formatIn('en').label(1001, true)).toBe('more than 1,000')
    expect(formatIn('nl').label(1001, true)).toBe('meer dan 1.000')
  })

  it('shows totals up to 1,000 exactly, in the locale format', () => {
    const { text } = formatIn('en')
    expect(text(1000, true)).toBe('1,000')
    expect(text(999, true)).toBe('999')
    expect(formatIn('nl').text(1000, true)).toBe('1.000')
  })

  it('shows 1001 on a list the node counts exactly as the real number', () => {
    expect(formatIn('en').text(1001, false)).toBe('1,001')
    expect(formatIn('en').label(1001, false)).toBe('1,001')
  })
})
