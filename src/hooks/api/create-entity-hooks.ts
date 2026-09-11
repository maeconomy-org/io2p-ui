'use client'

// The React Query engine for io2p entity resources (objects/processes): list/get/create/update/
// delete/restore with narrow per-entity invalidation. Network-agnostic — driven by `select(client)`
// + a key namespace, so it unit-tests against a fake resource.

import { useCallback } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  Io2pClient,
  EntityGetOptions,
  ReadOptions,
  CreateOptions,
  UpdateOptions,
  WriteOptions,
  Page,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'

const DEFAULT_STALE_TIME = 30_000

/**
 * `ListDto` is SEPARATE from `Dto` because the node's lists are LEAN by default: a row carries
 * identity, attributes and thin refs, while `properties` — and a process flow's own data — arrive
 * only with `?full=true` or from `GET /{id}`.
 *
 * Keeping one generic for both would let a table read `properties` off a list row and render
 * nothing, with no error anywhere. Two generics turn that into a compile failure.
 */
/**
 * Options that change the SHAPE of a detail response, and therefore its cache key. Shared by the
 * read and the prefetch so a hover warms exactly what opening the sheet will ask for.
 */
export interface DetailReadOptions {
  enrichFiles?: boolean
  /** Include soft-deleted properties/values/files, each carrying its own `deleted` flag. */
  includeDeleted?: boolean
}

export interface EntityResource<
  Dto,
  ListDto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
> {
  list: (query?: ListQuery, options?: ReadOptions) => Promise<Page<ListDto>>
  // EntityGetOptions, not GetOptions: objects and processes carry a soft-deletable authored
  // tree, so their detail read accepts `includeDeleted`. Templates are hand-written, not from here.
  get: (id: string, options?: EntityGetOptions) => Promise<Dto>
  create: (body: CreateBody, options?: CreateOptions) => Promise<CreateResp>
  update: (
    id: string,
    body: UpdateBody,
    options?: UpdateOptions
  ) => Promise<Dto>
  delete: (id: string, options?: WriteOptions) => Promise<Dto>
  restore: (id: string, options?: WriteOptions) => Promise<Dto>
}

export interface EntityKeys<ListQuery> {
  lists: () => readonly unknown[]
  list: (query?: ListQuery) => readonly unknown[]
  details: () => readonly unknown[]
  detail: (id: string) => readonly unknown[]
}

export interface EntityHooksConfig<
  Dto,
  ListDto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
> {
  select: (
    client: Io2pClient
  ) => EntityResource<
    Dto,
    ListDto,
    ListQuery,
    CreateBody,
    CreateResp,
    UpdateBody
  >
  keys: EntityKeys<ListQuery>
  staleTime?: number
}

export function createEntityHooks<
  Dto,
  ListDto,
  ListQuery,
  CreateBody,
  CreateResp,
  UpdateBody,
>(
  config: EntityHooksConfig<
    Dto,
    ListDto,
    ListQuery,
    CreateBody,
    CreateResp,
    UpdateBody
  >
) {
  const { select, keys, staleTime = DEFAULT_STALE_TIME } = config

  function useList(
    query?: ListQuery,
    options?: { enabled?: boolean; keepPreviousData?: boolean }
  ) {
    const client = useIomClient()
    return useQuery({
      queryKey: keys.list(query),
      queryFn: ({ signal }) => select(client).list(query, { signal }),
      enabled: options?.enabled ?? true,
      placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
      staleTime,
    })
  }

  /**
   * The ONE place a detail read's key and request are derived.
   *
   * Both options change the response SHAPE, so both belong in the key — otherwise a read that asked
   * for deleted sub-items (or enriched files) would be served one that didn't, with no error to
   * notice. Only non-default values contribute, so existing keys are unchanged.
   *
   * Shared with the prefetch on purpose. When each derived its own key, hover cached a plain
   * `get(id)` under the bare key while the sheet asked for `{enrichFiles, includeDeleted}` under a
   * suffixed one — so the prefetch could never be read, and every hover paid for a request the
   * sheet then repeated.
   */
  function detailQuery(
    client: Io2pClient,
    id: string,
    options?: DetailReadOptions
  ) {
    const shape: string[] = []
    if (options?.includeDeleted) shape.push('withDeleted')
    if (options?.enrichFiles === false) shape.push('thinFiles')

    return {
      queryKey: shape.length ? [...keys.detail(id), ...shape] : keys.detail(id),
      // Annotated because this returns a bare object, not a `useQuery` argument — there is no
      // contextual type here for React Query to infer the context from.
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        select(client).get(id, {
          enrichFiles: options?.enrichFiles,
          includeDeleted: options?.includeDeleted,
          signal,
        }),
      staleTime,
    }
  }

  function useGet(
    id: string | undefined,
    options?: DetailReadOptions & { enabled?: boolean }
  ) {
    const client = useIomClient()
    return useQuery({
      ...detailQuery(client, id ?? '', options),
      enabled: !!id && options?.enabled !== false,
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

  /**
   * Warm the detail cache before it is asked for — on row hover, so the sheet
   * opens populated instead of mounting into a spinner.
   *
   * The key and queryFn match `useGet`'s DEFAULT shape (no `includeDeleted`, no
   * `thinFiles`); a caller using those options gets its own key and simply
   * misses this cache rather than being served the wrong shape. `prefetchQuery`
   * is a no-op while the entry is still fresh, so repeated pointer-enters cost
   * nothing.
   */
  /**
   * Warm the detail cache on hover.
   *
   * MUST be called with the same options the sheet reads with — they are part of the key, so a
   * mismatch caches something nothing will ever ask for and the hover becomes pure cost.
   */
  function usePrefetchDetail(options?: DetailReadOptions) {
    const client = useIomClient()
    const qc = useQueryClient()
    const shapeKey = `${options?.enrichFiles ?? ''}:${options?.includeDeleted ?? ''}`
    return useCallback(
      (id: string) => {
        if (!id) return
        void qc.prefetchQuery(detailQuery(client, id, options))
      },
      // `shapeKey` rather than `options`, which is a fresh object literal on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [client, qc, shapeKey]
    )
  }

  return {
    useList,
    useGet,
    useCreate,
    useUpdate,
    useRemove,
    useRestore,
    usePrefetchDetail,
  }
}
