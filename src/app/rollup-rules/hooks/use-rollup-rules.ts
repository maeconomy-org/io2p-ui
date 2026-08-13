'use client'

/**
 * Fixture-backed stand-in for `client.rollupRules.*`, which `io2p-client` does not expose yet.
 *
 * The bundle mirrors `useConstants()` exactly, and everything above this file is written against
 * the real shape — so wiring the node means replacing five `queryFn`/`mutationFn` bodies and
 * deleting the store below. Nothing else in the feature knows the data is local.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type { Page } from 'io2p-client'

import { queryKeys } from '@/lib/query-keys'
import { MAX_LIST_PAGE_SIZE } from '@/constants'

import {
  normalizeRollupPropertyKey,
  type CreateRollupRuleBody,
  type ListRollupRulesQuery,
  type RollupRuleDTO,
} from '../lib/rollup-rule'

// ── the store ───────────────────────────────────────────────────────────────
// Everything from here to `listPage()` goes away with the SDK.

const HOUR = 3_600_000

/** Enough round-trip that the table's `fetching` rows and the button spinners are visible. */
const FAKE_LATENCY_MS = 300

const seed = (
  propertyKey: string,
  system: boolean,
  ageHours: number
): RollupRuleDTO => {
  const ts = Date.now() - ageHours * HOUR
  return {
    id: crypto.randomUUID(),
    propertyKey,
    aggregation: 'sum',
    system,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
  }
}

let store: RollupRuleDTO[] = [
  seed('weight', true, 720),
  seed('volume', true, 720),
  seed('co2-equivalent', true, 720),
  seed('price', false, 48),
  seed('quantity', false, 3),
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function listPage(query: ListRollupRulesQuery): Page<RollupRuleDTO> {
  const deleted = query.deleted ?? 'exclude'
  const matched = store
    .filter(
      (rule) => query.system === undefined || rule.system === query.system
    )
    .filter((rule) =>
      deleted === 'include'
        ? true
        : deleted === 'only'
          ? rule.deleted
          : !rule.deleted
    )
    .sort((a, b) =>
      query.sort === 'createdAt'
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt
    )

  const start = (query.page - 1) * query.size
  return {
    data: matched.slice(start, start + query.size),
    page: {
      number: query.page,
      size: query.size,
      totalElements: matched.length,
      totalPages: Math.ceil(matched.length / query.size),
    },
  }
}

function find(id: string): RollupRuleDTO {
  const rule = store.find((r) => r.id === id)
  if (!rule)
    throw Object.assign(new Error('Rollup rule not found'), { status: 404 })
  return rule
}

// ── hooks ───────────────────────────────────────────────────────────────────

const ROLLUP_STALE_TIME = 30_000

function useRollupRuleList(
  query: ListRollupRulesQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.rollupRules.list(query),
    queryFn: async () => {
      await sleep(FAKE_LATENCY_MS)
      return listPage(query)
    },
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousData ? keepPreviousData : undefined,
    staleTime: ROLLUP_STALE_TIME,
  })
}

/**
 * Every rule the caller owns — the create form's duplicate check.
 *
 * `system: false` IS "mine": another account's rules 404 on every route, so the tier filter is the
 * whole scope. The per-user cap is env-tunable on the node, so a deployment allowing more than
 * `MAX_LIST_PAGE_SIZE` rules would leave this page short and the check would miss a duplicate —
 * the node's 409 is what actually enforces it.
 */
function useOwnRollupRules() {
  const query: ListRollupRulesQuery = {
    page: 1,
    size: MAX_LIST_PAGE_SIZE,
    system: false,
  }
  return useRollupRuleList(query)
}

function useRollupRuleCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { body: CreateRollupRuleBody }) => {
      await sleep(FAKE_LATENCY_MS)
      const propertyKey = normalizeRollupPropertyKey(vars.body.propertyKey)
      if (store.some((r) => r.propertyKey === propertyKey && !r.system)) {
        throw Object.assign(new Error('Key taken'), { status: 409 })
      }
      const now = Date.now()
      const created: RollupRuleDTO = {
        id: crypto.randomUUID(),
        propertyKey,
        aggregation: vars.body.aggregation,
        system: false,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      }
      store = [...store, created]
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

function useRollupRuleRemove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      await sleep(FAKE_LATENCY_MS)
      const rule = find(vars.id)
      if (rule.system) {
        throw Object.assign(new Error('System rule'), { status: 403 })
      }
      const now = Date.now()
      store = store.map((r) =>
        r.id === vars.id
          ? { ...r, deleted: true, deletedAt: now, updatedAt: now }
          : r
      )
      return find(vars.id)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

function useRollupRuleRestore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      await sleep(FAKE_LATENCY_MS)
      find(vars.id)
      store = store.map((r) =>
        r.id === vars.id
          ? {
              ...r,
              deleted: false,
              deletedAt: undefined,
              updatedAt: Date.now(),
            }
          : r
      )
      return find(vars.id)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

const rollupRuleBundle = {
  useList: useRollupRuleList,
  useOwnRules: useOwnRollupRules,
  useCreate: useRollupRuleCreate,
  useRemove: useRollupRuleRemove,
  useRestore: useRollupRuleRestore,
}

export function useRollupRules() {
  return rollupRuleBundle
}
