'use client'

/**
 * `createEntityHooks` — the React Query engine every io2p-core *entity* resource rides on.
 *
 * Objects / processes / templates share one surface (`list/get/create/update/delete/restore`) over the
 * `properties[].values[].files[]` substrate; they differ only by facet (objects add hierarchy, processes add
 * inputs/outputs). Rather than hand-write three near-identical hook files, this factory wires the query keys,
 * narrow invalidation, and staleTime once and takes the resource + its key namespace as config. See
 * `internal-docs/ui-refactor-plan.md` §12 (the archetype model).
 *
 * The factory is auth/network-agnostic — it drives whatever `EntityResource` `select(client)` returns, so it
 * unit-tests against a fake resource with no SDK. Instantiation for a concrete resource (`useObjects` etc.)
 * happens in that resource's vertical, where its query-key shape is finalized.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  Io2pClient,
  GetOptions,
  CreateOptions,
  UpdateOptions,
  WriteOptions,
} from 'io2p-client'

import type { Page } from '@/types/iom'
import { useIomClient } from '@/lib/io2p'

/** Default freshness for entity reads (matches the old hooks' 30s); override per resource. */
const DEFAULT_STALE_TIME = 30_000

/** The subset of an io2p entity resource the hooks drive (objects & processes satisfy this structurally). */
export interface EntityResource<
  Dto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
> {
  list: (query?: ListQuery) => Promise<Page<Dto>>
  get: (id: string, options?: GetOptions) => Promise<Dto>
  create: (body: CreateBody, options?: CreateOptions) => Promise<CreateResp>
  update: (
    id: string,
    body: UpdateBody,
    options?: UpdateOptions
  ) => Promise<Dto>
  delete: (id: string, options?: WriteOptions) => Promise<Dto>
  restore: (id: string, options?: WriteOptions) => Promise<Dto>
}

/** The query-key namespace the factory invalidates through (a slice of the `queryKeys` factory). */
export interface EntityKeys<ListQuery> {
  lists: () => readonly unknown[]
  list: (query?: ListQuery) => readonly unknown[]
  details: () => readonly unknown[]
  detail: (id: string) => readonly unknown[]
}

export interface EntityHooksConfig<
  Dto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
> {
  /** Pick this resource off the io2p client (e.g. `(c) => c.objects`). */
  select: (
    client: Io2pClient
  ) => EntityResource<Dto, ListQuery, CreateBody, CreateResp, UpdateBody>
  /** This resource's key namespace (e.g. `queryKeys.objects`). */
  keys: EntityKeys<ListQuery>
  /** Read freshness; defaults to 30s. */
  staleTime?: number
}

export function createEntityHooks<
  Dto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
>(
  config: EntityHooksConfig<Dto, ListQuery, CreateBody, CreateResp, UpdateBody>
) {
  const { select, keys, staleTime = DEFAULT_STALE_TIME } = config

  /** Paginated list. `keepPreviousData` avoids a blank flash across page/filter changes. */
  function useList(
    query?: ListQuery,
    options?: { enabled?: boolean; keepPreviousData?: boolean }
  ) {
    const client = useIomClient()
    return useQuery({
      queryKey: keys.list(query),
      queryFn: () => select(client).list(query),
      enabled: options?.enabled ?? true,
      placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
      staleTime,
    })
  }

  /** Single entity by id — the whole aggregate in one call. Disabled until `id` is present. */
  function useGet(
    id: string | undefined,
    options?: { enabled?: boolean; enrichFiles?: boolean }
  ) {
    const client = useIomClient()
    return useQuery({
      queryKey: keys.detail(id ?? ''),
      queryFn: () =>
        select(client).get(id!, { enrichFiles: options?.enrichFiles }),
      enabled: !!id && options?.enabled !== false,
      staleTime,
    })
  }

  function useCreate() {
    const client = useIomClient()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (vars: { body: CreateBody; options?: CreateOptions }) =>
        select(client).create(vars.body, vars.options),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: keys.lists() })
      },
    })
  }

  function useUpdate() {
    const client = useIomClient()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (vars: {
        id: string
        body: UpdateBody
        options?: UpdateOptions
      }) => select(client).update(vars.id, vars.body, vars.options),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: keys.detail(vars.id) })
        qc.invalidateQueries({ queryKey: keys.lists() })
      },
    })
  }

  function useRemove() {
    const client = useIomClient()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (vars: { id: string; options?: WriteOptions }) =>
        select(client).delete(vars.id, vars.options),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: keys.detail(vars.id) })
        qc.invalidateQueries({ queryKey: keys.lists() })
      },
    })
  }

  function useRestore() {
    const client = useIomClient()
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (vars: { id: string; options?: WriteOptions }) =>
        select(client).restore(vars.id, vars.options),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: keys.detail(vars.id) })
        qc.invalidateQueries({ queryKey: keys.lists() })
      },
    })
  }

  return { useList, useGet, useCreate, useUpdate, useRemove, useRestore }
}
