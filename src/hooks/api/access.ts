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
  AccessPageQuery,
  CreateShareBody,
  GrantBody,
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
 * The active grants on one resource.
 *
 * Owner/admin only — the node 403s anyone else, which is correct and means a `write` sharee opening
 * an entity must not see this at all. Callers gate on ownership rather than swallowing the error,
 * so a real failure still surfaces.
 */
function useGrantList(
  resource: WhoCanAccessInput | undefined,
  query?: AccessPageQuery,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.access.grants.forResource(
      resource?.resourceType ?? '',
      resource?.resourceId ?? ''
    ),
    queryFn: () => client.access.grants.list(resource!, query),
    enabled: !!resource?.resourceId && options?.enabled !== false,
    staleTime: ACCESS_STALE_TIME,
  })
}

/** Everything the caller has shared, paginated BY RESOURCE — a resource's grants never split. */
function useSharedByMe(
  query?: AccessPageQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.access.grants.sharedByMe(query),
    queryFn: () => client.access.grants.sharedByMe(query),
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.access.grants.forResource(
          vars.body.resource.type,
          vars.body.resource.id
        ),
      })
      // The resource may now appear in (or vanish from) a scoped list.
      qc.invalidateQueries({ queryKey: queryKeys.access.all })
    },
  })
}

/** Idempotent — `revoked: false` when there was nothing to revoke, which is not an error. */
function useRevoke() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: RevokeBody; options?: WriteOptions }) =>
      client.access.grants.revoke(vars.body, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.access.grants.forResource(
          vars.body.resource.type,
          vars.body.resource.id
        ),
      })
      qc.invalidateQueries({ queryKey: queryKeys.access.all })
    },
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
    queryFn: () => client.access.shares.list(query),
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
