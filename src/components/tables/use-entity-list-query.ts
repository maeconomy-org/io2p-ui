'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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

const SORTS: readonly EntitySort[] = [
  'name',
  '-name',
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
]
const SCOPES: readonly EntityScope[] = ['mine', 'shared', 'public', 'all']
const DELETEDS: readonly EntityDeleted[] = ['exclude', 'include', 'only']

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | null
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

export function parseEntityListQuery(
  params: URLSearchParams,
  defaults: EntityListQueryDefaults = {}
): EntityListQuery {
  const size = Number(params.get('size'))
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    size: size > 0 ? size : (defaults.size ?? 15),
    sort: oneOf(SORTS, params.get('sort')) ?? defaults.sort,
    q: params.get('q') || undefined,
    scope: oneOf(SCOPES, params.get('scope')) ?? defaults.scope,
    deleted: oneOf(DELETEDS, params.get('deleted')),
  }
}

// Serialize back to a query string, omitting defaults so the URL stays clean.
export function entityListQueryToSearch(
  query: EntityListQuery,
  defaults: EntityListQueryDefaults = {}
): string {
  const p = new URLSearchParams()
  if (query.page > 1) p.set('page', String(query.page))
  if (query.size !== (defaults.size ?? 15)) p.set('size', String(query.size))
  if (query.sort && query.sort !== defaults.sort) p.set('sort', query.sort)
  if (query.q) p.set('q', query.q)
  if (query.scope && query.scope !== defaults.scope) p.set('scope', query.scope)
  if (query.deleted) p.set('deleted', query.deleted)
  return p.toString()
}

export function useEntityListQuery(defaults: EntityListQueryDefaults = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = useMemo(
    () => parseEntityListQuery(new URLSearchParams(searchParams), defaults),
    // `searchParams` is a stable ref keyed by the URL; defaults are caller-static.

    [searchParams]
  )

  const apply = useCallback(
    (next: EntityListQuery) => {
      const qs = entityListQueryToSearch(next, defaults)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },

    [router, pathname]
  )

  // Any change other than paging resets to page 1.
  const setPage = useCallback(
    (page: number) => apply({ ...query, page }),
    [apply, query]
  )
  const setSize = useCallback(
    (size: number) => apply({ ...query, size, page: 1 }),
    [apply, query]
  )
  const setSort = useCallback(
    (sort?: EntitySort) => apply({ ...query, sort, page: 1 }),
    [apply, query]
  )
  const setSearch = useCallback(
    (q?: string) => apply({ ...query, q: q || undefined, page: 1 }),
    [apply, query]
  )
  const setScope = useCallback(
    (scope?: EntityScope) => apply({ ...query, scope, page: 1 }),
    [apply, query]
  )
  const setDeleted = useCallback(
    (deleted?: EntityDeleted) => apply({ ...query, deleted, page: 1 }),
    [apply, query]
  )

  return {
    query,
    setPage,
    setSize,
    setSort,
    setSearch,
    setScope,
    setDeleted,
  }
}
