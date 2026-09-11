'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  CreateRollupRuleBody,
  ListRollupRulesQuery,
  UpdateRollupRuleBody,
} from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { MAX_LIST_PAGE_SIZE } from '@/constants'

const ROLLUP_STALE_TIME = 30_000

function useRollupRuleList(
  query: ListRollupRulesQuery,
  options?: { enabled?: boolean; keepPreviousData?: boolean }
) {
  const client = useIomClient()
  return useQuery({
    queryKey: queryKeys.rollupRules.list(query),
    queryFn: ({ signal }) => client.rollupRules.list(query, { signal }),
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
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { body: CreateRollupRuleBody }) =>
      client.rollupRules.create(vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

/**
 * The only PATCH this resource has: `multiplyBy`, and `null` clears it.
 *
 * `propertyKey` and `aggregation` stay immutable — every stored total pins the ruleId, so changing
 * a key is still delete-then-create. Changing the multiplier re-arms every entity holding the key
 * on the node, which is why the totals cannot keep their old meaning and need no invalidation here
 * beyond the rule itself.
 */
function useRollupRuleUpdate() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateRollupRuleBody }) =>
      client.rollupRules.update(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

function useRollupRuleRemove() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.rollupRules.delete(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

function useRollupRuleRestore() {
  const client = useIomClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.rollupRules.restore(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rollupRules.lists() })
    },
  })
}

/**
 * Queue a recompute across every entity holding the rule's key, plus their ancestors.
 *
 * The node answers 202 the moment the job is enqueued, so this resolving means QUEUED, never
 * done — the totals land as the lane drains. Nothing here can be invalidated on success for the
 * same reason: the rule itself did not change, and the entity rollups it will move are keyed per
 * object and refetched by their own poll.
 */
function useRollupRuleRecompute() {
  const client = useIomClient()
  return useMutation({
    mutationFn: (vars: { id: string }) => client.rollupRules.recompute(vars.id),
  })
}

const rollupRuleBundle = {
  useList: useRollupRuleList,
  useOwnRules: useOwnRollupRules,
  useCreate: useRollupRuleCreate,
  useUpdate: useRollupRuleUpdate,
  useRemove: useRollupRuleRemove,
  useRestore: useRollupRuleRestore,
  useRecompute: useRollupRuleRecompute,
}

export function useRollupRules() {
  return rollupRuleBundle
}
