// What the objects list sends while a search is active. The node reads `q` as a plain substring,
// so the parsed filters have to reach the wire as their own params, not inside `q`.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type {
  ParsedSearch,
  SearchListType,
} from '@/components/global-search/search-parser'
import {
  parseSearchQuery,
  toListParams,
} from '@/components/global-search/search-parser'

const useList = vi.fn()
const { entityTable } = vi.hoisted(() => ({
  entityTable: vi.fn((_props: Record<string, unknown>) => null),
}))
// The page passes its own list type; the mock maps the parsed search with it, as the real hook does.
let parsed: ParsedSearch | null = null

vi.mock('@/hooks/api/entities', () => ({
  OBJECT_DETAIL_READ: {},
  useObjects: () => ({ useList, usePrefetchDetail: () => vi.fn() }),
}))

vi.mock('@/contexts', () => ({
  useAuth: () => ({ userId: 'u-1', authLoading: false }),
  useListSearch: (type: SearchListType) =>
    parsed ? toListParams(parsed, type) : null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/objects',
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}))

vi.mock('next/dynamic', () => ({ default: () => () => null }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['table', vi.fn(), true],
}))
vi.mock('@/hooks/ui/use-column-visibility', () => ({
  useColumnVisibility: () => [{}, vi.fn()],
}))
vi.mock('@/hooks/ui/use-scope-preference', () => ({
  useScopePreference: () => ['all', vi.fn(), 'all'],
}))
vi.mock('@/hooks/data/use-breadcrumb-trail', () => ({
  useBreadcrumbTrail: () => ({ clearTrail: vi.fn() }),
}))
vi.mock('@/hooks/drafts', () => ({
  useObjectDrafts: () => ({ drafts: [], deleteDraft: vi.fn() }),
}))

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

vi.mock('@/app/objects/components/columns-view', () => ({
  ObjectColumnsView: () => null,
}))
vi.mock('@/app/objects/components/object-bulk-bar', () => ({
  ObjectBulkBar: () => null,
}))
vi.mock('@/app/objects/components/object-row-portals', () => ({
  ObjectRowPortals: () => null,
}))
vi.mock('@/app/objects/components/use-object-list-page', () => ({
  useObjectListPage: () => ({
    columns: [],
    rowSelection: {},
    setRowSelection: vi.fn(),
    selectedObjects: [],
  }),
}))
vi.mock('@/components/onboarding/page-help', () => ({ PageHelp: () => null }))

import ObjectsPage from '@/app/objects/page'

const queryOf = () => useList.mock.calls.at(-1)?.[0]
const tableProps = () => entityTable.mock.calls.at(-1)?.[0] ?? {}

describe('objects page — the list query during a search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    parsed = null
    useList.mockReturnValue({ data: undefined, isFetching: false })
  })

  it('lists roots only, with no q, when no search is active', () => {
    render(<ObjectsPage />)
    expect(queryOf()).toMatchObject({ parent: '' })
    expect(queryOf().q).toBeUndefined()
  })

  it('sends each filter as its own param and only the free text as q', () => {
    parsed = parseSearchQuery(
      'prop:material=steel createdBy:u-2 deleted:true beton'
    )
    render(<ObjectsPage />)

    expect(queryOf()).toMatchObject({
      property: ['material:steel'],
      createdBy: 'u-2',
      deleted: 'only',
      q: 'beton',
    })
    // A nested match is still a match, so a search is not limited to roots.
    expect(queryOf().parent).toBeUndefined()
  })

  it('sends a parent: filter as the parent param', () => {
    parsed = parseSearchQuery('parent:p-1')
    render(<ObjectsPage />)
    expect(queryOf()).toMatchObject({ parent: 'p-1' })
  })

  it('stays the top-level list when no filter of the search applies', () => {
    parsed = parseSearchQuery('prop:a:b=c')
    render(<ObjectsPage />)

    expect(queryOf()).toMatchObject({ parent: '' })
    expect(screen.getByTestId('search-filter-note')).toBeInTheDocument()
    // The empty text follows the same rule as the query.
    expect(tableProps().emptyTitle).toBe('objects.noObjectsTitle')
    expect(tableProps().emptyAction).toBeDefined()
  })

  it('says an empty search found no results, with no create button', () => {
    parsed = parseSearchQuery('beton')
    render(<ObjectsPage />)

    expect(tableProps().emptyTitle).toBe('search.noResultsTitle')
    expect(tableProps().emptyAction).toBeUndefined()
  })

  it('says which filters it could not apply', () => {
    parsed = parseSearchQuery('prop:a:b=c beton')
    render(<ObjectsPage />)
    expect(screen.getByTestId('search-filter-note')).toBeInTheDocument()
  })
})
