import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import type {
  UUMathFormulaDTO,
  UUMathFormulaCalcDTO,
  NodeFindDTO,
  UUMathFormulaCalcFindDTO,
} from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

interface PageParams {
  page?: number
  size?: number
}

// This hook reads the LEGACY node, while `hooks/api/leaves.ts` reads io2p — and both were writing to
// `queryKeys.formulas.*`. A legacy DTO served under the shared detail key has `expression` but no
// `variables`, so `FormulaBindings` would render a formula with nothing to bind; a legacy delete
// invalidated `formulas.all` and dropped the io2p cache with it. Its own root keeps the two apart
// until this file is deleted.
const LEGACY_ROOT = ['legacy-formulas'] as const
const legacyKeys = {
  all: LEGACY_ROOT,
  list: (params?: unknown) => [...LEGACY_ROOT, 'list', params] as const,
  detail: (uuid: string) => [...LEGACY_ROOT, 'detail', uuid] as const,
}

export function useMathFormulas() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // ─── Query Hooks ───────────────────────────────────────────

  const useSearchFormulas = (
    params?: NodeFindDTO,
    pagination?: PageParams,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: legacyKeys.list({ ...params, ...pagination }),
      queryFn: async ({ signal }) => {
        return client.node.searchMathFormulas(params ?? {}, pagination, {
          signal,
        })
      },
      enabled: options?.enabled !== false,
      placeholderData: keepPreviousData,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  const useFormulaByUUID = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: legacyKeys.detail(uuid),
      queryFn: async ({ signal }) => {
        if (!uuid) return null
        const page = await client.node.searchMathFormulas(
          { uuid },
          { page: 0, size: 1 },
          { signal }
        )
        return page?.content?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // ─── Formula Mutations ─────────────────────────────────────

  const useCreateFormula = () => {
    return useMutation({
      mutationFn: async (formula: UUMathFormulaDTO) => {
        return client.node.createOrUpdateMathFormula(formula)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: legacyKeys.all,
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  const useDeleteFormula = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        await client.node.softDeleteMathFormula(uuid)
        return uuid
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({
          queryKey: legacyKeys.all,
        })
        queryClient.removeQueries({
          queryKey: legacyKeys.detail(deletedUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  // ─── Calculation Mutations ─────────────────────────────────

  const useCreateFormulaCalc = () => {
    return useMutation({
      mutationFn: async (calc: UUMathFormulaCalcDTO) => {
        return client.node.createOrUpdateMathFormulaCalc(calc)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: legacyKeys.all,
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  const useSearchFormulaCalcs = (
    params?: UUMathFormulaCalcFindDTO,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: [...legacyKeys.all, 'calcs', params] as const,
      queryFn: async ({ signal }) => {
        return client.node.searchMathFormulaCalcs(params ?? {}, {
          signal,
        })
      },
      enabled: options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  const useDeleteFormulaCalc = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        await client.node.softDeleteMathFormulaCalc(uuid)
        return uuid
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: legacyKeys.all,
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  return {
    useSearchFormulas,
    useFormulaByUUID,
    useCreateFormula,
    useDeleteFormula,
    useCreateFormulaCalc,
    useSearchFormulaCalcs,
    useDeleteFormulaCalc,
  }
}
