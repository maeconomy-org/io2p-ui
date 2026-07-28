import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  UUStatementDTO,
  UUStatementsAccessFindDTO,
  UUID,
  UUStatementsProperty,
  Predicate,
} from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export function useStatements() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const t = useTranslations()

  // Search statements via POST /api/UUStatements/search
  const useAllStatements = (
    options?: UUStatementsAccessFindDTO & { enabled?: boolean }
  ) => {
    const { enabled = true, ...body } = options || {}
    return useQuery({
      queryKey: queryKeys.statements.list(body),
      queryFn: async () => {
        return await client.node.searchStatements(body)
      },
      enabled,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Search statements by predicate (useful for filtering process relationships)
  // Uses accessFind: { readDefaultGroup: true } to search within user's groups
  const useStatementsByPredicate = (
    predicate: string,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: queryKeys.statements.byPredicate(predicate),
      queryFn: async () => {
        return await client.node.searchStatements({
          uuStatementFind: {
            predicate: predicate as Predicate,
            softDeleted: false,
          },
          accessFind: { readDefaultGroup: true },
        })
      },
      enabled: !!predicate && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Create statement mutation - using new simplified method
  const useCreateStatement = () => {
    return useMutation({
      mutationFn: async (statement: UUStatementDTO) => {
        const response = await client.node.createStatement(statement)
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.statements.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  // Create multiple statements in a single batch call
  const useCreateStatements = () => {
    return useMutation({
      mutationFn: async (statements: UUStatementDTO[]) => {
        const response = await client.node.createStatements(statements)
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.statements.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Create process-enhanced statement with direct properties (internal - no auto-invalidation)

  // Create batch process statements for a complete process flow

  // Find all relationships for an entity (legacy - use useObjectRelationships instead)
  const useFindAllRelationships = (
    entityUuid: UUID,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: queryKeys.statements.relationships(entityUuid),
      queryFn: async () => {
        return await client.node.searchStatements({
          uuStatementFind: { subject: entityUuid },
        })
      },
      enabled: !!entityUuid && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Optimized: Get all relationships for an object in both directions with single query
  const useObjectRelationships = (
    objectUuid: UUID,
    options?: {
      enabled?: boolean
      predicate?: string
      includeDeleted?: boolean
    }
  ) => {
    const { enabled = true, predicate, includeDeleted = false } = options || {}

    return useQuery({
      queryKey: queryKeys.statements.objectRelationships(
        objectUuid,
        predicate,
        includeDeleted
      ),
      queryFn: async () => {
        // Make parallel requests for both directions
        const [asSubjectResponse, asObjectResponse] = await Promise.all([
          client.node.searchStatements({
            uuStatementFind: {
              subject: objectUuid,
              predicate: predicate as Predicate,
              softDeleted: includeDeleted,
            },
          }),
          client.node.searchStatements({
            uuStatementFind: {
              object: objectUuid,
              predicate: predicate as Predicate,
              softDeleted: includeDeleted,
            },
          }),
        ])

        const asSubject = asSubjectResponse || []
        const asObject = asObjectResponse || []

        // Return structured data for easy consumption
        return {
          asSubject,
          asObject,
          combined: [...asSubject, ...asObject],
          total: asSubject.length + asObject.length,
        }
      },
      enabled: !!objectUuid && enabled,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  const useDeleteStatement = () => {
    return useMutation({
      mutationFn: async (params: UUStatementDTO) => {
        const response = await client.node.softDeleteStatement(
          params.subject,
          params.predicate,
          params.object
        )
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.statements.lists(),
        })
      },
      onError: (error: Error) => {
        toast.error(t('import.statementDeleteFailed', { error: error.message }))
      },
    })
  }

  /**
   * Query formula calc statements for an object.
   * Returns HAS_MATH_FORMULA_CALC statements where the object is the subject.
   */
  const useFormulaCalcStatements = (
    objectUuid: UUID,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: queryKeys.statements.objectRelationships(
        objectUuid,
        'HAS_MATH_FORMULA_CALC'
      ),
      queryFn: async () => {
        const response = await client.node.searchStatements({
          uuStatementFind: {
            subject: objectUuid,
            predicate: 'HAS_MATH_FORMULA_CALC' as Predicate,
            softDeleted: false,
          },
        })
        return response || []
      },
      enabled: !!objectUuid && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  return {
    useAllStatements,
    useStatementsByPredicate,
    useCreateStatement,
    useCreateStatements,
    useFindAllRelationships,
    useObjectRelationships,
    useFormulaCalcStatements,
    useDeleteStatement,
  }
}
