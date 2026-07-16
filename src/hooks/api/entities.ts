'use client'

// io2p entity hooks the migration rewires consumers onto. Kept out of the barrel so they coexist with
// the dormant use-objects/use-processes until their consumers move. Templates omitted — its writes
// carry no idempotency/If-Match, so its signatures don't fit the factory's EntityResource.

import { useQuery } from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import type {
  ObjectDTO,
  ProcessDTO,
  CreateObjectInput,
  CreateObjectResponse,
  UpdateObjectBody,
  CreateProcessInput,
  CreateProcessResponse,
  UpdateProcessBody,
  ListObjectsQuery,
  ListProcessesQuery,
} from 'io2p-client'

import { createEntityHooks } from './create-entity-hooks'

const OBJECT_STALE_TIME = 30_000

const objectBase = createEntityHooks<
  ObjectDTO,
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
