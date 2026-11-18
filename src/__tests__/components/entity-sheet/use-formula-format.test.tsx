import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import { useFormulaFormat } from '@/components/entity-sheet/fields/use-formula-format'

function formatIn(locale: 'en' | 'nl') {
  const { result } = renderHook(() => useFormulaFormat(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    ),
  })
  return result.current
}

describe('useFormulaFormat', () => {
  it('writes a sentence number in the app locale, grouped', () => {
    expect(formatIn('en').number(1000)).toBe('1,000')
    expect(formatIn('nl').number(1000)).toBe('1.000')
  })

  // The default three decimals print a conversion constant such as 0.000001 as 0.
  it('keeps a small constant', () => {
    expect(formatIn('nl').number(0.000001)).toBe('0,000001')
  })

  it('gives an equation the decimal mark its numbers use, and no thousands groups', () => {
    expect(formatIn('en').equation).toMatchObject({ decimal: '.' })
    expect(formatIn('nl').equation).toMatchObject({ decimal: ',' })
    expect(formatIn('en').equation.number(1000.5)).toBe('1000.5')
    expect(formatIn('nl').equation.number(1000.5)).toBe('1000,5')
  })
})
