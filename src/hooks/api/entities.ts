'use client'

/**
 * The io2p-client entity hooks — `objects` and `processes` instantiated on the `createEntityHooks`
 * factory. These are the TARGET hooks the migration rewires consumers onto; they live here (not the
 * `hooks/api` barrel yet) so they coexist with the dormant `use-objects`/`use-processes` during the
 * transition. When the last consumer moves, the dormant files delete and the barrel flips to these.
 *
 * `templates` is NOT here: the node honors no idempotency/If-Match on template writes, so its
 * `update/delete/restore` signatures differ from `EntityResource` — it gets its own hook later.
 */

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
} from '@/types/iom'

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

/** Direct children of `parentId` (the node's `?parent=` filter) — a paginated `Page<ObjectDTO>`. */
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

/** The whole descendant subtree of `ancestorId` (the node's `?ancestor=` filter). */
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

/** The objects entity hooks: `useList/useGet/useCreate/useUpdate/useRemove/useRestore` + hierarchy. */
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

/** The processes entity hooks (no hierarchy — processes have no parent/ancestor filter). */
export function useProcesses() {
  return processBundle
}
