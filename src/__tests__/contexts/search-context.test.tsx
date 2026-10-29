import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

const push = vi.fn()
let pathname = '/objects'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
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

beforeEach(() => {
  push.mockClear()
  pathname = '/objects'
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

describe('where a search lands', () => {
  const useOn = () => ({
    search: useSearch(),
    processes: useListSearch('processes'),
    objects: useListSearch('objects'),
    templates: useListSearch('templates'),
  })

  it.each(['/processes', '/formulas', '/constants', '/templates', '/shares'])(
    'stays on %s when it starts there',
    (page) => {
      pathname = page
      const { result } = renderHook(useOn, { wrapper })

      act(() => result.current.search.executeAdvancedSearch('beton'))

      expect(push).not.toHaveBeenCalled()
      expect(result.current.search.isSearchMode).toBe(true)
    }
  )

  it('applies on the page it started from', () => {
    pathname = '/processes'
    const { result } = renderHook(useOn, { wrapper })

    act(() => result.current.search.executeAdvancedSearch('prop:material'))

    expect(result.current.processes?.params).toEqual({
      property: ['material'],
    })
  })

  it('goes to the objects list from a page that shows no results', () => {
    pathname = '/objects/obj-1'
    const { result } = renderHook(useOn, { wrapper })

    act(() => result.current.search.executeAdvancedSearch('beton'))

    expect(push).toHaveBeenCalledWith('/objects')
  })

  it('goes to the templates list for template:true, and applies there', () => {
    pathname = '/processes'
    const { result, rerender } = renderHook(useOn, { wrapper })

    act(() =>
      result.current.search.executeAdvancedSearch('template:true beton')
    )
    expect(push).toHaveBeenCalledWith('/templates')

    pathname = '/templates'
    rerender()
    expect(result.current.templates?.params).toEqual({ q: 'beton' })
  })

  it('goes to the objects list for template:false', () => {
    pathname = '/templates'
    const { result } = renderHook(useOn, { wrapper })

    act(() =>
      result.current.search.executeAdvancedSearch('template:false beton')
    )

    expect(push).toHaveBeenCalledWith('/objects')
  })

  it('stays active on a detail page under the list it belongs to', () => {
    const { result, rerender } = renderHook(useOn, { wrapper })
    act(() => result.current.search.executeAdvancedSearch('beton'))

    pathname = '/objects/obj-1'
    rerender()

    expect(result.current.search.isSearchMode).toBe(true)
  })

  it('ends when the user moves to another list', () => {
    pathname = '/processes'
    const { result, rerender } = renderHook(useOn, { wrapper })
    act(() => result.current.search.executeAdvancedSearch('beton'))

    pathname = '/objects'
    rerender()

    expect(result.current.search.isSearchMode).toBe(false)
    expect(result.current.objects).toBeNull()
  })
})
