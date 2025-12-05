import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  UUStatementDTO,
  StatementQueryParams,
  UUID,
  UUStatementsProperty,
  Predicate,
} from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'
import type { ProcessMetadata, MaterialFlowMetadata } from '@/types'

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
        materialMetadata,
      }: {
        subject: UUID
        predicate: Predicate
        object: UUID
        processMetadata: ProcessMetadata
        materialMetadata?: MaterialFlowMetadata
      }) => {
        // Create statement properties from process metadata
        const properties: UUStatementsProperty[] = [
          // Core process properties
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
        ]

        // Add process-level lifecycle metadata
        if (processMetadata.processCategory) {
          properties.push({
            key: 'processCategory',
            values: [{ value: processMetadata.processCategory }],
          })
        }
        if (processMetadata.isRecycling !== undefined) {
          properties.push({
            key: 'isRecycling',
            values: [{ value: String(processMetadata.isRecycling) }],
          })
        }
        if (processMetadata.isDeconstruction !== undefined) {
          properties.push({
            key: 'isDeconstruction',
            values: [{ value: String(processMetadata.isDeconstruction) }],
          })
        }
        if (processMetadata.sourceBuildingUuid) {
          properties.push({
            key: 'sourceBuildingUuid',
            values: [{ value: processMetadata.sourceBuildingUuid }],
          })
        }
        if (processMetadata.targetBuildingUuid) {
          properties.push({
            key: 'targetBuildingUuid',
            values: [{ value: processMetadata.targetBuildingUuid }],
          })
        }

        // Add material-level flow metadata if provided
        if (materialMetadata) {
          Object.entries(materialMetadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              properties.push({
                key,
                values: [{ value: String(value) }],
              })
            }
          })
        }

        // Add any additional metadata properties not already handled
        Object.entries(processMetadata)
          .filter(
            ([key]) =>
              ![
                'processName',
                'processType', 
                'quantity',
                'unit',
                'processCategory',
                'isRecycling',
                'isDeconstruction',
                'sourceBuildingUuid',
                'targetBuildingUuid'
              ].includes(key)
          )
          .forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              properties.push({
                key,
                values: [{ value: String(value) }],
              })
            }
          })

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
        processMetadata,
        inputMaterials,
        outputMaterials,
      }: {
        processMetadata: ProcessMetadata
        inputMaterials: Array<{ 
          uuid: UUID
          quantity: number
          unit: string
          metadata?: MaterialFlowMetadata
        }>
        outputMaterials: Array<{ 
          uuid: UUID
          quantity: number
          unit: string
          metadata?: MaterialFlowMetadata
        }>
      }) => {
        const results = []

        // Create ONLY input relationships (input materials → output materials)
        // This avoids creating redundant IS_OUTPUT_OF statements that cause cycles
        for (const input of inputMaterials) {
          for (const output of outputMaterials) {
            // Create namespaced metadata to avoid conflicts
            const namespacedMetadata: MaterialFlowMetadata = {}
            
            // Add input-specific properties with "input_" prefix
            if (input.metadata) {
              Object.entries(input.metadata).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  (namespacedMetadata as any)[`input_${key}`] = value
                }
              })
            }
            
            // Add output-specific properties with "output_" prefix  
            if (output.metadata) {
              Object.entries(output.metadata).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  (namespacedMetadata as any)[`output_${key}`] = value
                }
              })
            }
            
            // Add input quantity and unit with namespace
            namespacedMetadata.input_quantity = input.quantity
            namespacedMetadata.input_unit = input.unit
            
            // Add output quantity and unit with namespace (always store both)
            if (output.quantity !== undefined) {
              namespacedMetadata.output_quantity = output.quantity
            }
            if (output.unit) {
              namespacedMetadata.output_unit = output.unit
            }

            const result = await createProcessStatementMutation.mutateAsync({
              subject: input.uuid,
              predicate: 'IS_INPUT_OF' as Predicate,
              object: output.uuid,
              processMetadata: {
                ...processMetadata,
                // No legacy quantity/unit - use namespaced versions only
              },
              materialMetadata: namespacedMetadata,
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
