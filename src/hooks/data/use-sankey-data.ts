import { useMemo } from 'react'

import { useObjects, useStatements, useMaterialFlowProcessing } from '@/hooks'

interface UseSankeyDataProps {
  objectUuid?: string | null
}

interface SankeyData {
  materials: any[]
  relationships: any[]
  isLoading: boolean
}

/**
 * Custom hook to manage sankey data fetching and processing
 * Handles both sample data and real data with optional object filtering
 */
export function useSankeyData({ objectUuid }: UseSankeyDataProps): SankeyData {
  const { useStatementsByPredicate, useObjectRelationships } = useStatements()
  const { useObjectsByUUIDs } = useObjects()

  // Optimized: Single call for object-specific relationships
  const { data: objectRelationships, isLoading: objectRelationshipsLoading } =
    useObjectRelationships(objectUuid || '', {
      enabled: !!objectUuid,
      predicate: 'IS_INPUT_OF',
      includeDeleted: false,
    })

  // Fetch all IS_INPUT_OF statements when not filtering by specific object
  const { data: inputStatements, isLoading: statementsLoading } =
    useStatementsByPredicate('IS_INPUT_OF' as any, {
      enabled: !objectUuid,
    })

  // Combine statements based on filtering mode
  const combinedStatements = useMemo(() => {
    if (!objectUuid) return inputStatements
    return objectRelationships?.combined || []
  }, [objectUuid, objectRelationships, inputStatements])

  // Extract unique object UUIDs from statements for optimized fetching
  const participatingObjectUuids = useMemo(() => {
    if (!combinedStatements) return []

    const uuids = new Set<string>()
    combinedStatements.forEach((statement) => {
      uuids.add(statement.subject)
      uuids.add(statement.object)
    })

    return Array.from(uuids)
  }, [combinedStatements])

  // Optimized: Only fetch objects that participate in relationships (exclude soft-deleted)
  const { data: realObjects, isLoading: objectsLoading } = useObjectsByUUIDs(
    participatingObjectUuids,
    {
      enabled: participatingObjectUuids.length > 0,
      includeDeleted: false,
    }
  )

  // Process real data using material flow processing hook
  const { materials, relationships } = useMaterialFlowProcessing({
    inputStatements: combinedStatements,
    realObjects: realObjects || null,
    enabled: true,
  })

  // Determine loading state
  const isLoading =
    statementsLoading || objectsLoading || objectRelationshipsLoading

  return {
    materials,
    relationships,
    isLoading,
  }
}
