'use client'

import { useCallback, useState } from 'react'

import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

export type EntitySort =
  | 'name'
  | '-name'
  | 'createdAt'
  | '-createdAt'
  | 'updatedAt'
  | '-updatedAt'
export type EntityScope = 'mine' | 'shared' | 'public' | 'all'
export type EntityDeleted = 'exclude' | 'include' | 'only'

// Common list-query params shared by every entity resource (subset of io2p's ListObjectsQuery,
// so it's assignable where a resource query is expected).
export interface EntityListQuery {
  page: number
  size: number
  sort?: EntitySort
  q?: string
  scope?: EntityScope
  deleted?: EntityDeleted
}

export interface EntityListQueryDefaults {
  size?: number
  sort?: EntitySort
  scope?: EntityScope
}

export function useEntityListQuery(defaults: EntityListQueryDefaults = {}) {
  const [query, setQuery] = useState<EntityListQuery>(() => ({
    page: 1,
    size: defaults.size ?? DEFAULT_TABLE_PAGE_SIZE,
    sort: defaults.sort,
    scope: defaults.scope,
  }))

  // Any change other than paging resets to page 1.
  const setPage = useCallback(
    (page: number) => setQuery((q) => ({ ...q, page })),
    []
  )
  const setSort = useCallback(
    (sort?: EntitySort) => setQuery((q) => ({ ...q, sort, page: 1 })),
    []
  )
  const setSearch = useCallback(
    (q?: string) =>
      setQuery((prev) => ({ ...prev, q: q || undefined, page: 1 })),
    []
  )
  const setScope = useCallback(
    (scope?: EntityScope) => setQuery((q) => ({ ...q, scope, page: 1 })),
    []
  )
  const setDeleted = useCallback(
    (deleted?: EntityDeleted) => setQuery((q) => ({ ...q, deleted, page: 1 })),
    []
  )

  return { query, setPage, setSort, setSearch, setScope, setDeleted }
}
