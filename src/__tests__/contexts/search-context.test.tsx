import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/objects',
  useRouter: () => ({ push: vi.fn() }),
}))

import {
  SearchProvider,
  useListSearch,
  useSearch,
} from '@/contexts/search-context'
import { parseSearchQuery } from '@/components/global-search/search-parser'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SearchProvider>{children}</SearchProvider>
)

const useBoth = () => ({
  search: useSearch(),
  objects: useListSearch('objects'),
})

describe('the search a list receives', () => {
  it('is the parsed filters, not the display string', () => {
    const { result } = renderHook(useBoth, { wrapper })

    act(() =>
      result.current.search.executeSearchFromParsed(
        parseSearchQuery('prop:material value:steel beton')
      )
    )

    expect(result.current.objects?.params).toEqual({
      property: ['material', ':steel'],
      q: 'beton',
    })
  })

  // The search box reopens with this string, and Enter parses it again.
  it('keeps the tokens as typed, so a second Enter parses to the same filters', () => {
    const { result } = renderHook(useBoth, { wrapper })
    const typed = 'prop:material value:steel beton'

    act(() =>
      result.current.search.executeSearchFromParsed(parseSearchQuery(typed))
    )

    expect(result.current.search.searchQuery).toBe(typed)
    expect(parseSearchQuery(result.current.search.searchQuery)).toEqual(
      parseSearchQuery(typed)
    )
  })

  it('is null with no search, and again after the search is cleared', () => {
    const { result } = renderHook(useBoth, { wrapper })
    expect(result.current.objects).toBeNull()

    act(() => result.current.search.executeAdvancedSearch('prop:material'))
    expect(result.current.objects?.params).toEqual({ property: ['material'] })

    act(() => result.current.search.clearSearch())
    expect(result.current.objects).toBeNull()
  })
})
