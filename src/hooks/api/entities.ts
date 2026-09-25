'use client'

// io2p entity hooks the migration rewires consumers onto. Kept out of the barrel so they coexist with
// the dormant use-objects/use-processes until their consumers move. Templates are hand-written (below)
// rather than factory-built — their writes carry no idempotency/If-Match, so the signatures differ.

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import type { TemplateShareDependency } from '@/types'
import type {
  EntityRollupEntry,
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

import {
  createEntityHooks,
  type DetailReadOptions,
} from './create-entity-hooks'

/**
 * How the object detail sheet reads. Exported because the hover PREFETCH must match it exactly —
 * these options are part of the cache key, so warming with anything else caches a response the
 * sheet will never ask for.
 *
 * Soft-deleted sub-items are asked for so they render struck-through with a Restore action, rather
 * than silently vanishing: nothing is destroyed, so nothing should look destroyed.
 */
export const OBJECT_DETAIL_READ: DetailReadOptions = {
  enrichFiles: true,
  includeDeleted: true,
}

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
    queryFn: ({ signal }) =>
      client.objects.children(parentId!, query, { signal }),
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
    queryFn: ({ signal }) =>
      client.objects.subtree(ancestorId!, query, { signal }),
    enabled: !!ancestorId && options?.enabled !== false,
    staleTime: OBJECT_STALE_TIME,
  })
}

/**
 * Matches the node's `ROLLUP_COOLDOWN_MS` default: a target recomputed inside the cooldown is
 * deferred, so a faster poll spends the 300/min budget re-reading a number that cannot have moved.
 */
export const ROLLUP_POLL_MS = 30_000

/**
 * How many consecutive ticks a never-computed entry is worth waiting for.
 *
 * The node returns ONE ENTRY PER VISIBLE RULE on every object, and synthesizes
 * `{ stale: true, computedAt: null }` for any that has no state row. A row is only ever
 * materialized for an entity that HOLDS the rule's key or is an ancestor of one — arming
 * fans out over key-holders, and the reconcile's never-computed scan does too — so an object
 * whose whole subtree holds none of a rule's key has an entry that is permanently
 * `stale: true`. With twelve seeded system rules that is almost every object.
 *
 * `stale` alone therefore polls forever on nearly every open sheet. But an ARRIVING entry
 * looks identical on the wire, and refusing to poll it was the previous bug (a correctly
 * configured rule showed nothing until the sheet was reopened). Nothing distinguishes them,
 * so the honest answer is a BOUND, not a predicate: wait a few minutes for something that
 * may be arriving, then stop. Reopening the sheet starts a fresh window.
 */
const NEVER_COMPUTED_TICKS = 10 // 10 x 30s = 5 minutes

/**
 * Keep polling while any rule's recompute is still queued. One stale entry is enough — the
 * others being settled says nothing about that one.
 *
 * An entry with a `computedAt` is a KNOWN recompute of an existing row: it is definitely
 * moving, so it is polled without limit. An entry that has never computed is polled only
 * while `ticks` is inside the bound above — see `NEVER_COMPUTED_TICKS` for why the two
 * cannot be told apart any other way.
 */
export function rollupPollInterval(
  data: { data: EntityRollupEntry[] } | undefined,
  ticks = 0
): number | false {
  const stale = data?.data.filter((entry) => entry.stale) ?? []
  if (stale.length === 0) return false
  if (stale.some((entry) => entry.computedAt !== null)) return ROLLUP_POLL_MS
  return ticks < NEVER_COMPUTED_TICKS ? ROLLUP_POLL_MS : false
}

/**
 * Computed subtree totals for one object — the object itself plus every descendant.
 *
 * OWNER-ONLY on the node: a `read` grant does not reach it and a non-owner gets 404, so the caller
 * gates on `createdBy === userId` rather than on `permission` (a grantee can hold `admin` and still
 * be refused). Totals are not part of the object and never become properties on it, which is why
 * this is a second request rather than a field on `useGet`.
 */
function useObjectRollups(
  id: string | undefined,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.objects.rollups(id ?? ''),
    queryFn: ({ signal }) => client.objects.rollups(id!, { signal }),
    enabled: !!id && options?.enabled !== false,
    // The app-wide default is 30s, so without this a poll tick landing inside that window is
    // served from cache: the interval fires and the number never moves.
    staleTime: 0,
    // `dataUpdateCount` is the tick counter: it rises once per settled fetch, so it counts
    // this query's polls for as long as the sheet holds it. A remount starts it at 0 again,
    // which is the intended escape hatch — reopening a sheet re-asks.
    refetchInterval: (query) =>
      rollupPollInterval(query.state.data, query.state.dataUpdateCount - 1),
  })
}

const objectBundle = {
  ...objectBase,
  useChildren: useObjectChildren,
  useSubtree: useObjectSubtree,
  useRollups: useObjectRollups,
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
    queryFn: ({ signal }) => client.templates.list(query, { signal }),
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
    queryFn: ({ signal }) =>
      client.templates.get(id!, { enrichFiles: options?.enrichFiles, signal }),
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

/**
 * The formulas and constants a template's recipes bind, and the caller's relation to each.
 *
 * Server-side because the walk is not shallow — a process template's flows are property containers
 * too — and because a list row carries no properties to walk in the first place. Reports only what
 * the template needs; it never reads a prospective recipient's grants.
 */
function useTemplateShareDependencies(
  id: string | undefined,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.templates.shareDependencies(id ?? ''),
    queryFn: ({ signal }) =>
      client.templates.shareDependencies(id!, { signal }),
    enabled: !!id && options?.enabled !== false,
  })
}

/**
 * The same question for a SELECTION of templates, merged into one answer.
 *
 * Two templates commonly bind the same formula, so the merge dedupes by id — otherwise a bulk share
 * would offer the same item twice and grant it twice.
 */
function useTemplateShareDependenciesFor(ids: readonly string[]) {
  const client = useIomClient()
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.templates.shareDependencies(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        client.templates.shareDependencies(id, { signal }),
    })),
    combine: (results) => {
      const formulas = new Map<string, TemplateShareDependency>()
      const constants = new Map<string, TemplateShareDependency>()
      for (const { data } of results) {
        data?.formulas.forEach((f) => formulas.set(f.id, f))
        data?.constants.forEach((c) => constants.set(c.id, c))
      }
      return {
        formulas: [...formulas.values()],
        constants: [...constants.values()],
      }
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
  useShareDependencies: useTemplateShareDependencies,
  useShareDependenciesFor: useTemplateShareDependenciesFor,
}

export function useTemplates() {
  return templateBundle
}
