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
      queryKey: queryKeys.formulas.list({ ...params, ...pagination }),
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
      queryKey: queryKeys.formulas.detail(uuid),
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
          queryKey: queryKeys.formulas.all,
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
          queryKey: queryKeys.formulas.all,
        })
        queryClient.removeQueries({
          queryKey: queryKeys.formulas.detail(deletedUuid),
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
          queryKey: queryKeys.formulas.all,
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
      queryKey: [...queryKeys.formulas.all, 'calcs', params] as const,
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
          queryKey: queryKeys.formulas.all,
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
