'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type { CreateRollupRuleBody, ListRollupRulesQuery } from 'io2p-client'

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
    queryFn: () => client.rollupRules.list(query),
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
