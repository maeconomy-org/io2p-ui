'use client'

// Leaf-archetype resource hooks (formulas + constants): name + expression/data, no properties/values.
// Hand-written (not the entity factory): formulas have no update (immutable — replace by create),
// constants append versions instead of updating. Kept out of the barrel like entities.ts.

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
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
    queryFn: () => client.formulas.list(query),
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
    queryFn: () => client.formulas.get(id!),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.formulas.lists() })
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
    queryFn: () => client.constants.list(query),
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
    queryFn: () => client.constants.get(id!),
    enabled: !!id && options?.enabled !== false,
    staleTime: LEAF_STALE_TIME,
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

const constantBundle = {
  useList: useConstantList,
  useGet: useConstantGet,
  useCreate: useConstantCreate,
  useAppendVersion: useConstantAppendVersion,
  useRemove: useConstantRemove,
}

export function useConstants() {
  return constantBundle
}
