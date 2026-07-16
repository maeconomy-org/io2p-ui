'use client'

// The React Query engine for io2p entity resources (objects/processes): list/get/create/update/
// delete/restore with narrow per-entity invalidation. Network-agnostic — driven by `select(client)`
// + a key namespace, so it unit-tests against a fake resource.

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

const DEFAULT_STALE_TIME = 30_000

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
  select: (
    client: Io2pClient
  ) => EntityResource<Dto, ListQuery, CreateBody, CreateResp, UpdateBody>
  keys: EntityKeys<ListQuery>
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
