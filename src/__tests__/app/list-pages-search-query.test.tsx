// What each list page sends while a search is active. A list that does not take a filter must not
// get it: the node ignores an undeclared param and would return an unfiltered list.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'

import type {
  ParsedSearch,
  SearchListType,
} from '@/components/global-search/search-parser'
import {
  parseSearchQuery,
  toListParams,
} from '@/components/global-search/search-parser'

// The page passes its own list type; the mock maps the parsed search with it, as the real hook does.
let parsed: ParsedSearch | null = null

// Every page reads `useList` plus a few mutation hooks; any other hook answers as a mutation.
const { useList, resource, entityTable } = vi.hoisted(() => {
  const useList = vi.fn()
  const entityTable = vi.fn((_props: Record<string, unknown>) => null)
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })
  const resource = () =>
    new Proxy({}, { get: (_, key) => (key === 'useList' ? useList : mutation) })
  return { useList, resource, entityTable }
})

vi.mock('@/hooks/api/entities', () => ({
  useProcesses: resource,
  useTemplates: resource,
}))
vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: resource,
  useConstants: resource,
}))
vi.mock('@/hooks/api/access', () => ({ useShares: resource }))

vi.mock('@/contexts', () => ({
  useAuth: () => ({ userId: 'u-1', authLoading: false }),
  useListSearch: (type: SearchListType) =>
    parsed ? toListParams(parsed, type) : null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '', number: String }),
}))

vi.mock('next/dynamic', () => ({ default: () => () => null }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['table', vi.fn(), true],
}))
vi.mock('@/hooks/ui/use-scope-preference', () => ({
  useScopePreference: () => ['all', vi.fn(), 'all'],
}))
vi.mock('@/components/onboarding/page-help', () => ({ PageHelp: () => null }))

vi.mock('@/components/entity-list', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/entity-list')
  >('@/components/entity-list')
  return {
    ...actual,
    EntityTable: entityTable,
    useEntityListFilters: () => ({
      pageSize: 20,
      handlePageSizeChange: vi.fn(),
      showDeleted: false,
      setShowDeleted: vi.fn(),
    }),
  }
})

import ProcessesPage from '@/app/processes/page'
import FormulasPage from '@/app/formulas/page'
import ConstantsPage from '@/app/constants/page'
import TemplatesPage from '@/app/templates/page'
import SharesPage from '@/app/shares/page'

const PAGES: [SearchListType, ComponentType][] = [
  ['processes', ProcessesPage],
  ['templates', TemplatesPage],
  ['formulas', FormulasPage],
  ['constants', ConstantsPage],
  ['shares', SharesPage],
]

const TAKES_PROPERTY = new Set<SearchListType>(['processes', 'templates'])

const queryOf = () => useList.mock.calls.at(-1)?.[0]
const tableProps = () => entityTable.mock.calls.at(-1)?.[0] ?? {}

describe.each(PAGES)(
  '%s page — the list query during a search',
  (type, Page) => {
    beforeEach(() => {
      vi.clearAllMocks()
      parsed = null
      useList.mockReturnValue({ data: undefined, isFetching: false })
    })

    it('sends no search params when no search is active', () => {
      render(<Page />)
      expect(queryOf().q).toBeUndefined()
      expect(queryOf().property).toBeUndefined()
    })

    it('sends the filters it takes and only the free text as q', () => {
      parsed = parseSearchQuery(
        'prop:material=steel createdBy:u-2 deleted:false beton'
      )
      render(<Page />)

      expect(queryOf()).toMatchObject({
        createdBy: 'u-2',
        deleted: 'exclude',
        q: 'beton',
      })
      if (TAKES_PROPERTY.has(type)) {
        expect(queryOf().property).toEqual(['material:steel'])
        expect(screen.queryByTestId('search-filter-note')).toBeNull()
      } else {
        expect(queryOf()).not.toHaveProperty('property')
        expect(screen.getByTestId('search-filter-note')).toBeInTheDocument()
      }
      expect(queryOf()).not.toHaveProperty('parent')
    })

    it('says an empty list found no results, rather than that nothing exists', () => {
      parsed = parseSearchQuery('beton')
      render(<Page />)

      expect(tableProps().emptyTitle).toBe('search.noResultsTitle')
      expect(tableProps().emptyAction).toBeUndefined()
    })

    it('asks for page 1 of a new search, not the page the list was on', () => {
      const { rerender } = render(<Page />)
      act(() => (tableProps().onPageChange as (page: number) => void)(3))
      expect(queryOf().page).toBe(3)

      parsed = parseSearchQuery('beton')
      rerender(<Page />)

      expect(queryOf()).toMatchObject({ page: 1, q: 'beton' })
    })

    it('keeps its own empty text when no filter of the search applies', () => {
      parsed = parseSearchQuery('parent:p-1')
      render(<Page />)

      expect(tableProps().emptyTitle).not.toBe('search.noResultsTitle')
    })
  }
)
