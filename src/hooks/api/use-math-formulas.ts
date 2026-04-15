import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  UUMathFormulaDTO,
  UUMathFormulaCalcDTO,
  UUMathFormulaFindDTO,
  UUMathFormulaCalcFindDTO,
} from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useMathFormulas() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // ─── Query Hooks ───────────────────────────────────────────

  const useSearchFormulas = (
    params?: UUMathFormulaFindDTO,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: queryKeys.formulas.list(params),
      queryFn: async ({ signal }) => {
        return client.node.searchMathFormulas(params ?? {}, { signal })
      },
      enabled: options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  const useFormulaByUUID = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: queryKeys.formulas.detail(uuid),
      queryFn: async ({ signal }) => {
        if (!uuid) return null
        const results = await client.node.searchMathFormulas(
          { uuid },
          { signal }
        )
        return results?.[0] || null
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
          queryKey: queryKeys.aggregates.lists(),
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
          queryKey: queryKeys.aggregates.lists(),
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
          queryKey: queryKeys.aggregates.lists(),
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
          queryKey: queryKeys.aggregates.lists(),
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
