'use client'

import { useLocale } from 'next-intl'
import { useMemo } from 'react'

import { useUnits } from '@/hooks/api/leaves'

import { type SearchGrammar, unitKeys } from './search-grammar'

export function decimalMarkOf(locale: string): '.' | ',' {
  const part = new Intl.NumberFormat(locale)
    .formatToParts(1.5)
    .find((p) => p.type === 'decimal')
  return part?.value === ',' ? ',' : '.'
}

/** The search grammar of this page: the units the node knows, and the locale's decimal mark. */
export function useSearchGrammar(): SearchGrammar {
  const locale = useLocale()
  const { data: units } = useUnits()
  return useMemo(
    () => ({
      units: units
        ? unitKeys(units.flatMap((u) => [u.symbol, ...(u.aliases ?? [])]))
        : null,
      decimalMark: decimalMarkOf(locale),
    }),
    [units, locale]
  )
}
