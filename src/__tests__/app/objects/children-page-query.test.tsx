// Regression test for a scope filter that was never sent.
//
// The node defaults `GET /objects` to `scope: 'mine'`, so a bare children query returns only
// the rows the VIEWER created. On a shared parent that is none of them — while the row's
// `childCount` honours access rather than scope and still reports the real number. The recipient
// saw "1119 children" on a parent that opened empty.
//
// The assertions pin the QUERY, not the render: `scope` has to reach the wire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const useList = vi.fn()
const useGet = vi.fn()
const mutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
})

vi.mock('@/hooks/api/entities', () => ({
  useObjects: () => ({
    useList,
    useGet,
    useRemove: mutation,
    useRestore: mutation,
  }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ uuid: 'parent-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/objects/parent-1',
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}))

vi.mock('next/dynamic', () => ({ default: () => () => null }))

// The page reads two account preferences (view type, hidden columns). Both reach
// `useAuth`, which needs a QueryClient this test deliberately does not build —
// the subject here is the QUERY, not preference plumbing.
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['table', vi.fn(), true],
}))

vi.mock('@/hooks/ui/use-column-visibility', () => ({
  useColumnVisibility: () => [{}, vi.fn()],
}))

vi.mock('@/hooks/data/use-breadcrumb-trail', () => ({
  useBreadcrumbTrail: () => ({
    ancestors: [],
    pushAncestor: vi.fn(),
    navigateToAncestor: vi.fn(),
    clearTrail: vi.fn(),
  }),
}))

// `useEntityListFilters` resolves the page size from an account preference, which reaches
// useAuth and the whole client stack. `useEntityListQuery` stays REAL — it builds the query.
vi.mock('@/components/entity-list', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/entity-list')
  >('@/components/entity-list')
  return {
    ...actual,
    EntityTable: () => null,
    useEntityListFilters: () => ({
      pageSize: 20,
      handlePageSizeChange: vi.fn(),
      showDeleted: false,
      setShowDeleted: vi.fn(),
    }),
  }
})

vi.mock('@/app/objects/components/object-bulk-bar', () => ({
  ObjectBulkBar: () => null,
}))
vi.mock('@/app/objects/components/object-row-portals', () => ({
  ObjectRowPortals: () => null,
}))

// The row/sheet plumbing the root list shares. It reaches templates, drafts and uploads, and
// none of it touches the children query.
vi.mock('@/app/objects/components/use-object-list-page', () => ({
  useObjectListPage: () => ({
    columns: [],
    rowSelection: {},
    setRowSelection: vi.fn(),
    selectedObjects: [],
  }),
}))

import ObjectChildrenPage from '@/app/objects/[uuid]/page'

const queryOf = () => useList.mock.calls.at(-1)?.[0]

describe('object children page — the children query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGet.mockReturnValue({
      data: { id: 'parent-1', name: 'Materials' },
      isLoading: false,
    })
    useList.mockReturnValue({ data: undefined, isFetching: false })
  })

  it('asks for every child the viewer can see, not only their own', () => {
    render(<ObjectChildrenPage />)
    // Without this the node applies `scope: 'mine'` and a shared parent opens empty.
    expect(queryOf()).toHaveProperty('scope', 'all')
  })

  it('filters to the direct children of the routed object', () => {
    render(<ObjectChildrenPage />)
    expect(queryOf()).toHaveProperty('parent', 'parent-1')
  })

  it('asks for child counts', () => {
    render(<ObjectChildrenPage />)
    expect(queryOf()).toHaveProperty('withChildCounts', true)
  })
})
