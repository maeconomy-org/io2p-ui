'use client'

// io2p entity hooks the migration rewires consumers onto. Kept out of the barrel so they coexist with
// the dormant use-objects/use-processes until their consumers move. Templates are hand-written (below)
// rather than factory-built — their writes carry no idempotency/If-Match, so the signatures differ.

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import type {
  ObjectDTO,
  ObjectListItem,
  ProcessDTO,
  ProcessListItem,
  CreateObjectInput,
  CreateObjectResponse,
  UpdateObjectBody,
  CreateProcessInput,
  CreateProcessResponse,
  UpdateProcessBody,
  CreateTemplateInput,
  UpdateTemplateBody,
  ListObjectsQuery,
  ListProcessesQuery,
  ListTemplatesQuery,
} from 'io2p-client'

import { createEntityHooks } from './create-entity-hooks'

const OBJECT_STALE_TIME = 30_000

const objectBase = createEntityHooks<
  ObjectDTO,
  ObjectListItem,
  ListObjectsQuery,
  CreateObjectInput,
  CreateObjectResponse,
  UpdateObjectBody
>({
  select: (client) => client.objects,
  keys: queryKeys.objects,
})

function useObjectChildren(
  parentId: string | undefined,
  query?: ListObjectsQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.objects.children(parentId ?? '', query),
    queryFn: () => client.objects.children(parentId!, query),
    enabled: !!parentId && options?.enabled !== false,
    staleTime: OBJECT_STALE_TIME,
  })
}

function useObjectSubtree(
  ancestorId: string | undefined,
  query?: ListObjectsQuery,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.objects.subtree(ancestorId ?? '', query),
    queryFn: () => client.objects.subtree(ancestorId!, query),
    enabled: !!ancestorId && options?.enabled !== false,
    staleTime: OBJECT_STALE_TIME,
  })
}

const objectBundle = {
  ...objectBase,
  useChildren: useObjectChildren,
  useSubtree: useObjectSubtree,
}

export function useObjects() {
  return objectBundle
}

const processBundle = createEntityHooks<
  ProcessDTO,
  ProcessListItem,
  ListProcessesQuery,
  CreateProcessInput,
  CreateProcessResponse,
  UpdateProcessBody
>({
  select: (client) => client.processes,
  keys: queryKeys.processes,
})

export function useProcesses() {
  return processBundle
}

// Templates: same entity shape as objects/processes but no idempotency/If-Match on writes, so it
// mirrors the factory's surface by hand over client.templates.
function useTemplateList(
  query?: ListTemplatesQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.templates.list(query),
    queryFn: () => client.templates.list(query),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: OBJECT_STALE_TIME,
  })
}

function useTemplateGet(
  id: string | undefined,
  options?: { enabled?: boolean; enrichFiles?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.templates.detail(id ?? ''),
    queryFn: () =>
      client.templates.get(id!, { enrichFiles: options?.enrichFiles }),
    enabled: !!id && options?.enabled !== false,
    staleTime: OBJECT_STALE_TIME,
  })
}

function useTemplateCreate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      body: CreateTemplateInput
      options?: { validate?: boolean }
    }) => client.templates.create(vars.body, vars.options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.lists() })
    },
  })
}

function useTemplateUpdate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateTemplateBody }) =>
      client.templates.update(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.templates.lists() })
    },
  })
}

function useTemplateRemove() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.templates.delete(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.templates.lists() })
    },
  })
}

function useTemplateRestore() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.templates.restore(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.templates.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.templates.lists() })
    },
  })
}

const templateBundle = {
  useList: useTemplateList,
  useGet: useTemplateGet,
  useCreate: useTemplateCreate,
  useUpdate: useTemplateUpdate,
  useRemove: useTemplateRemove,
  useRestore: useTemplateRestore,
}

export function useTemplates() {
  return templateBundle
}
