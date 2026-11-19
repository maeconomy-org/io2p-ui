import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  decimalMarkOf,
  useSearchGrammar,
} from '@/components/global-search/use-search-grammar'

const units = vi.hoisted(() => ({
  data: undefined as { symbol: string; aliases: string[] }[] | undefined,
}))
const locale = vi.hoisted(() => ({ value: 'en' }))

vi.mock('@/hooks/api/leaves', () => ({ useUnits: () => units }))
vi.mock('next-intl', () => ({ useLocale: () => locale.value }))

describe('decimalMarkOf', () => {
  it.each([
    ['en', '.'],
    ['nl', ','],
    ['de', ','],
    ['en-GB', '.'],
  ])('%s writes decimals with "%s"', (code, mark) => {
    expect(decimalMarkOf(code)).toBe(mark)
  })
})

describe('useSearchGrammar', () => {
  beforeEach(() => {
    units.data = undefined
    locale.value = 'en'
  })

  it('has no unit list until the node has answered', () => {
    const { result } = renderHook(() => useSearchGrammar())
    expect(result.current.units).toBeNull()
  })

  it('knows every symbol and alias, in the normal form of the node', () => {
    units.data = [
      { symbol: 't', aliases: ['tonne', 'ton'] },
      { symbol: 'kgCO2e', aliases: [] },
    ]
    const { result } = renderHook(() => useSearchGrammar())
    expect([...result.current.units!].sort()).toEqual(
      ['kgco2e', 't', 'ton', 'tonne'].sort()
    )
  })

  it('takes the decimal mark of the page locale', () => {
    locale.value = 'nl'
    const { result } = renderHook(() => useSearchGrammar())
    expect(result.current.decimalMark).toBe(',')
  })
})
