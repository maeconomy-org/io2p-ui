'use client'

// Access hooks — grants (the primitive) and shares (a named bundle that expands to grants).
// Together these replace the old groups model. Kept out of the barrel like entities.ts/leaves.ts.

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  CreateShareBody,
  GrantBody,
  ListGrantsQuery,
  ListSharedByMeQuery,
  ListSharesQuery,
  RevokeBody,
  UpdateShareBody,
  WhoCanAccessInput,
  WriteOptions,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

/**
 * Grants change only when somebody edits them here, but they are also the answer to "who can see
 * this" — worth being wrong about for less time than a formula is.
 */
const ACCESS_STALE_TIME = 30_000

// ── grants ──────────────────────────────────────────────────────────────────

/**
 * The grants on one resource — active only unless `query.revoked` says otherwise.
 *
 * Owner/admin only — the node 403s anyone else, which is correct and means a `write` sharee opening
 * an entity must not see this at all. Callers gate on ownership rather than swallowing the error,
 * so a real failure still surfaces.
 *
 * `query` reaches the cache key, not just the request: `revoked` changes which ROWS come back, so a
 * key without it would hand the active-only response to a caller asking for revoked ones.
 */
function useGrantList(
  resource: WhoCanAccessInput | undefined,
  query?: ListGrantsQuery,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.access.grants.forResource(
      resource?.resourceType ?? '',
      resource?.resourceId ?? '',
      query
    ),
    queryFn: ({ signal }) =>
      client.access.grants.list(resource!, query, { signal }),
    enabled: !!resource?.resourceId && options?.enabled !== false,
    staleTime: ACCESS_STALE_TIME,
  })
}

/**
 * Everything the caller has shared, paginated BY RESOURCE — a resource's grants never split.
 *
 * `query.source` narrows by GRANT SOURCE server-side (`direct` = ad-hoc only, `bundle` =
 * Share-expanded only). It has to be the server's job: filtering a page here would break both
 * numbers the response carries — a page of 20 resources might hold 3 direct ones, the total would
 * count rows we do not show, and page 2 could come back empty while page 3 has rows.
 */
function useSharedByMe(
  query?: ListSharedByMeQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.access.grants.sharedByMe(query),
    queryFn: ({ signal }) => client.access.grants.sharedByMe(query, { signal }),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: ACCESS_STALE_TIME,
  })
}

/**
 * Grant is an UPSERT on (resource, subject): re-granting at a different permission changes it
 * rather than adding a second row. So the member editor can send the same call for "add" and
 * "change permission" without tracking which it is.
 */
function useGrant() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: GrantBody; options?: WriteOptions }) =>
      client.access.grants.grant(vars.body, vars.options),
    // ONE invalidation. `access.all` is `['access']` — a PREFIX of the per-resource key — so
    // invalidating both marks the same query twice and refetches it twice.
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.access.all }),
  })
}

/** Idempotent — `revoked: false` when there was nothing to revoke, which is not an error. */
function useRevoke() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: RevokeBody; options?: WriteOptions }) =>
      client.access.grants.revoke(vars.body, vars.options),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.access.all }),
  })
}

export function useGrants() {
  return {
    useList: useGrantList,
    useSharedByMe,
    useGrant,
    useRevoke,
  }
}

// ── shares ──────────────────────────────────────────────────────────────────

function useShareList(
  query?: ListSharesQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.access.shares.list(query),
    queryFn: ({ signal }) => client.access.shares.list(query, { signal }),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: ACCESS_STALE_TIME,
  })
}

/**
 * Every share write also moves grants, so all three invalidate `access.all` rather than just the
 * share: the bundle is the authored thing, but the grants are what the rest of the app reads.
 */
function useShareCreate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: CreateShareBody }) =>
      client.access.shares.create(vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.access.all }),
  })
}

function useShareUpdate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateShareBody }) =>
      client.access.shares.update(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.access.all }),
  })
}

/** Deletes the bundle AND revokes every grant it owns. */
function useShareDelete() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.access.shares.delete(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.access.all }),
  })
}

/**
 * No `useGet` — the node has no get-by-id for a share (`GET /v1/shares` is the list). A list row is
 * the whole `ShareDTO`, resources and members included, so the editor opens from the row it was
 * clicked on rather than refetching.
 */
export function useShares() {
  return {
    useList: useShareList,
    useCreate: useShareCreate,
    useUpdate: useShareUpdate,
    useDelete: useShareDelete,
  }
}
