import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  UUStatementDTO,
  StatementQueryParams,
  UUID,
  UUStatementsProperty,
  Predicate,
} from 'iom-sdk'

import { useIomSdkClient } from '@/providers/query-provider'

export function useStatements() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all statements using the new unified API
  const useAllStatements = (
    options?: StatementQueryParams & { enabled?: boolean }
  ) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['statements', queryParams],
      queryFn: async () => {
        const response = await client.statements.getStatements(queryParams)
        return response.data
      },
      enabled,
    })
  }

  // Get statements by predicate (useful for filtering process relationships)
  const useStatementsByPredicate = (
    predicate: string,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: ['statements', 'predicate', predicate],
      queryFn: async () => {
        const response = await client.statements.getStatements({
          predicate: predicate as any,
          softDeleted: false, // Only get non-deleted statements
        })
        return response.data
      },
      enabled: !!predicate && options?.enabled !== false,
    })
  }

  // Create statement mutation - using new simplified method
  const useCreateStatement = () => {
    return useMutation({
      mutationFn: async (statement: UUStatementDTO) => {
        const response = await client.statements.create(statement)
        return response.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['statements'] })
      },
    })
  }

  // Create process-enhanced statement with direct properties
  const useCreateProcessStatement = () => {
    const createStatementMutation = useCreateStatement()

    return useMutation({
      mutationFn: async ({
        subject,
        predicate,
        object,
        processMetadata,
      }: {
        subject: UUID
        predicate: Predicate
        object: UUID
        processMetadata: {
          processName: string
          processType: string
          quantity: number
          unit: string
          [key: string]: any // Allow additional metadata
        }
      }) => {
        // Create statement properties from process metadata
        const properties: UUStatementsProperty[] = [
          {
            key: 'processName',
            values: [{ value: processMetadata.processName }],
          },
          {
            key: 'processType',
            values: [{ value: processMetadata.processType }],
          },
          {
            key: 'quantity',
            values: [{ value: processMetadata.quantity.toString() }],
          },
          {
            key: 'unit',
            values: [{ value: processMetadata.unit }],
          },
          // Add any additional metadata properties
          ...Object.entries(processMetadata)
            .filter(
              ([key]) =>
                !['processName', 'processType', 'quantity', 'unit'].includes(
                  key
                )
            )
            .map(([key, value]) => ({
              key,
              values: [{ value: String(value) }],
            })),
        ]

        // Create the statement with properties
        const statement = await createStatementMutation.mutateAsync({
          subject,
          predicate,
          object,
          properties,
        })

        return statement
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['statements'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Create batch process statements for a complete process flow
  const useCreateProcessFlow = () => {
    const createProcessStatementMutation = useCreateProcessStatement()

    return useMutation({
      mutationFn: async ({
        processName,
        processType,
        inputMaterials,
        outputMaterials,
      }: {
        processName: string
        processType: string
        inputMaterials: Array<{ uuid: UUID; quantity: number; unit: string }>
        outputMaterials: Array<{ uuid: UUID; quantity: number; unit: string }>
      }) => {
        const results = []

        // Create ONLY input relationships (input materials → output materials)
        // This avoids creating redundant IS_OUTPUT_OF statements that cause cycles
        for (const input of inputMaterials) {
          for (const output of outputMaterials) {
            const result = await createProcessStatementMutation.mutateAsync({
              subject: input.uuid,
              predicate: 'IS_INPUT_OF' as Predicate,
              object: output.uuid,
              processMetadata: {
                processName,
                processType,
                quantity: input.quantity,
                unit: input.unit,
              },
            })
            results.push(result)
          }
        }

        console.log(
          'Process flow created with',
          results.length,
          'statements:',
          results
        )

        return results
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['statements'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Delete statement mutation - using new simplified method
  const useDeleteStatement = () => {
    return useMutation({
      mutationFn: async (statement: UUStatementDTO) => {
        const response = await client.statements.delete(statement)
        return response.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['statements'] })
      },
    })
  }

  // Find all relationships for an entity (legacy - use useObjectRelationships instead)
  const useFindAllRelationships = (
    entityUuid: UUID,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: ['statements', 'relationships', entityUuid],
      queryFn: async () => {
        const response = await client.statements.getStatements({
          subject: entityUuid,
        })
        return response.data
      },
      enabled: !!entityUuid && options?.enabled !== false,
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
      queryKey: [
        'statements',
        'object-relationships',
        objectUuid,
        predicate,
        includeDeleted,
      ],
      queryFn: async () => {
        // Make parallel requests for both directions
        const [asSubjectResponse, asObjectResponse] = await Promise.all([
          client.statements.getStatements({
            subject: objectUuid,
            predicate: predicate as any,
            softDeleted: includeDeleted,
          }),
          client.statements.getStatements({
            object: objectUuid,
            predicate: predicate as any,
            softDeleted: includeDeleted,
          }),
        ])

        const asSubject = asSubjectResponse.data || []
        const asObject = asObjectResponse.data || []

        // Return structured data for easy consumption
        return {
          asSubject,
          asObject,
          combined: [...asSubject, ...asObject],
          total: asSubject.length + asObject.length,
        }
      },
      enabled: !!objectUuid && enabled,
    })
  }

  return {
    useAllStatements,
    useStatementsByPredicate,
    useCreateStatement,
    useCreateProcessStatement,
    useCreateProcessFlow,
    useDeleteStatement,
    useFindAllRelationships,
    useObjectRelationships,
  }
}
