'use client'

// Leaf-archetype resource hooks (formulas + constants): name + expression/data, no properties/values.
// Hand-written (not the entity factory): formulas have no update (immutable — replace by create),
// constants append versions instead of updating. Kept out of the barrel like entities.ts.

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  ConstantDTO,
  CreateFormulaBody,
  CreateConstantBody,
  AppendConstantVersionBody,
  ListFormulasQuery,
  ListConstantsQuery,
  WriteOptions,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

const LEAF_STALE_TIME = 30_000

// ── formulas ────────────────────────────────────────────────────────────────
function useFormulaList(
  query?: ListFormulasQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.formulas.list(query),
    queryFn: ({ signal }) => client.formulas.list(query, { signal }),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: LEAF_STALE_TIME,
  })
}

function useFormulaGet(
  id: string | undefined,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.formulas.detail(id ?? ''),
    queryFn: ({ signal }) => client.formulas.get(id!, { signal }),
    enabled: !!id && options?.enabled !== false,
    staleTime: LEAF_STALE_TIME,
  })
}

function useFormulaCreate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: CreateFormulaBody; options?: WriteOptions }) =>
      client.formulas.create(vars.body, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.formulas.lists() })
      // A correction WRITES to the target — the node stamps its `supersededBy` in the same
      // command. Every surface that warns about supersession reads the target through `useGet`,
      // so without this the formula just marked wrong keeps reading as fine until its cache
      // entry ages out.
      if (vars.body.correctionOf) {
        qc.invalidateQueries({
          queryKey: queryKeys.formulas.detail(vars.body.correctionOf),
        })
      }
    },
  })
}

function useFormulaRemove() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; options?: WriteOptions }) =>
      client.formulas.delete(vars.id, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.formulas.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.formulas.lists() })
    },
  })
}

function useFormulaRestore() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; options?: WriteOptions }) =>
      client.formulas.restore(vars.id, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.formulas.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.formulas.lists() })
    },
  })
}

const formulaBundle = {
  useList: useFormulaList,
  useGet: useFormulaGet,
  useCreate: useFormulaCreate,
  useRemove: useFormulaRemove,
  useRestore: useFormulaRestore,
}

export function useFormulas() {
  return formulaBundle
}

// ── constants ───────────────────────────────────────────────────────────────
function useConstantList(
  query?: ListConstantsQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.constants.list(query),
    queryFn: ({ signal }) => client.constants.list(query, { signal }),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: LEAF_STALE_TIME,
  })
}

function useConstantGet(
  id: string | undefined,
  options?: { enabled?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.constants.detail(id ?? ''),
    queryFn: ({ signal }) => client.constants.get(id!, { signal }),
    enabled: !!id && options?.enabled !== false,
    staleTime: LEAF_STALE_TIME,
  })
}

/**
 * Several constants by id, as a Map — for a screen that must show constants it did not search for.
 *
 * A calc names its constants by id, so the picker's search page is the wrong place to resolve them:
 * the bound one leaves that page the moment the user types. Each id is its own cached query, so a
 * constant already fetched by the picker or another binding costs nothing here.
 */
function useConstantsByIds(ids: readonly string[]) {
  const client = useIomClient()
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.constants.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        client.constants.get(id, { signal }),
      staleTime: LEAF_STALE_TIME,
    })),
    // Combined here rather than in the caller: `useQueries` gives this the same identity while the
    // underlying results are unchanged, so a consumer can depend on it without re-running on
    // every render.
    combine: (results) => {
      const byId = new Map<string, ConstantDTO>()
      for (const { data } of results) {
        if (data) byId.set(data.id, data)
      }
      return byId
    },
  })
}

function useConstantCreate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: CreateConstantBody; options?: WriteOptions }) =>
      client.constants.create(vars.body, vars.options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.constants.lists() })
    },
  })
}

function useConstantAppendVersion() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: AppendConstantVersionBody }) =>
      client.constants.appendVersion(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.constants.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.constants.lists() })
    },
  })
}

function useConstantRemove() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; options?: WriteOptions }) =>
      client.constants.delete(vars.id, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.constants.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.constants.lists() })
    },
  })
}

function useConstantRestore() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; options?: WriteOptions }) =>
      client.constants.restore(vars.id, vars.options),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.constants.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.constants.lists() })
    },
  })
}

const constantBundle = {
  useList: useConstantList,
  useGet: useConstantGet,
  useByIds: useConstantsByIds,
  useCreate: useConstantCreate,
  useAppendVersion: useConstantAppendVersion,
  useRemove: useConstantRemove,
  useRestore: useConstantRestore,
}

export function useConstants() {
  return constantBundle
}

// ── units ───────────────────────────────────────────────────────────────────
/**
 * The node's unit vocabulary — what an authored value string and a formula's declared result unit
 * may contain.
 *
 * No `staleTime` override: the app-wide default already caches for the session, which is what an
 * APPEND-ONLY list wants. A cached copy can only be missing units added by a later deploy, never
 * wrong about the ones it has, and the browser revalidates the GET on its own.
 */
export function useUnits(options?: { enabled?: boolean }) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.units.all,
    queryFn: ({ signal }) => client.units.all({ signal }),
    enabled: options?.enabled ?? true,
  })
}
