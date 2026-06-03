import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Predicate } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'
import {
  encodeProcess,
  decodeProcess,
  groupEdgesByProcess,
} from '@/components/processes/utils/process-codec'
import type { ProcessModel } from '@/types/process'

/**
 * Process data-access hooks — the seam the UI talks to (processes-redesign plan §7.1a).
 *
 * Internally these use the process-codec adapter over statements; the UI only ever sees
 * `ProcessModel`. When processes get their own API in the rewrite, only these hook bodies
 * (and the codec) change.
 */
export function useProcesses() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.statements.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.aggregates.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.processes.all })
  }

  /** Fetch all IS_INPUT_OF edges and decode them into ProcessModels (grouped by processId). */
  const useProcessList = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: queryKeys.processes.lists(),
      queryFn: async (): Promise<ProcessModel[]> => {
        const edges = await client.node.searchStatements({
          uuStatementFind: {
            predicate: 'IS_INPUT_OF' as Predicate,
            softDeleted: false,
          },
          accessFind: { readDefaultGroup: true },
        })
        const groups = groupEdgesByProcess(edges ?? [])
        return [...groups.values()]
          .map((g) => decodeProcess(g))
          .filter((p): p is ProcessModel => p !== null)
      },
      enabled: options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  /** Fetch all edges belonging to one process by its processId. */
  const fetchProcessEdges = async (processId: string) => {
    const edges = await client.node.searchStatements({
      uuStatementFind: {
        predicate: 'IS_INPUT_OF' as Predicate,
        softDeleted: false,
      },
      accessFind: { readDefaultGroup: true },
    })
    return groupEdgesByProcess(edges ?? []).get(processId) ?? []
  }

  /** Create a process: stamp a fresh processId and write one edge per input×output pair. */
  const useCreateProcess = () => {
    return useMutation({
      mutationFn: async (model: Omit<ProcessModel, 'processId'>) => {
        const processId = crypto.randomUUID()
        const edges = encodeProcess({ ...model, processId })
        if (edges.length === 0) {
          throw new Error('A process needs at least one input and one output')
        }
        await client.node.createStatements(edges)
        return processId
      },
      onSuccess: invalidate,
    })
  }

  /** Edit a process: delete its existing edges, then recreate from the new model. */
  const useUpdateProcess = () => {
    return useMutation({
      mutationFn: async (model: ProcessModel) => {
        const existing = await fetchProcessEdges(model.processId)
        for (const edge of existing) {
          await client.node.softDeleteStatement(
            edge.subject,
            edge.predicate,
            edge.object
          )
        }
        const edges = encodeProcess(model)
        if (edges.length > 0) {
          await client.node.createStatements(edges)
        }
        return model.processId
      },
      onSuccess: invalidate,
    })
  }

  /** Delete a process: soft-delete every edge sharing its processId. */
  const useDeleteProcess = () => {
    return useMutation({
      mutationFn: async (processId: string) => {
        const existing = await fetchProcessEdges(processId)
        for (const edge of existing) {
          await client.node.softDeleteStatement(
            edge.subject,
            edge.predicate,
            edge.object
          )
        }
        return processId
      },
      onSuccess: invalidate,
    })
  }

  return {
    useProcessList,
    useCreateProcess,
    useUpdateProcess,
    useDeleteProcess,
  }
}
