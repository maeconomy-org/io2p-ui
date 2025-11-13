import { useMemo } from 'react'
import type { UUStatementDTO, UUObjectDTO } from 'iom-sdk'

import { MaterialObject, MaterialRelationship } from '@/types'
import { processRelationshipStatement } from '@/hooks'

interface UseInputOutputProcessesProps {
  inputStatements: UUStatementDTO[] | null | undefined
  realObjects: UUObjectDTO[] | null | undefined
  enabled: boolean
}

interface InputOutputProcessesResult {
  materials: MaterialObject[]
  relationships: MaterialRelationship[]
}

/**
 * Custom hook to process statements and objects into materials and relationships
 * for process flow visualization
 */
export function useMaterialFlowProcessing({
  inputStatements,
  realObjects,
  enabled,
}: UseInputOutputProcessesProps): InputOutputProcessesResult {
  return useMemo(() => {
    if (!enabled || !inputStatements || !realObjects) {
      return { materials: [], relationships: [] }
    }

    // Create a map of objects for quick lookup
    const objectMap = new Map(realObjects.map((obj) => [obj.uuid, obj]))

    // Analyze statements to determine material types
    const inputMaterials = new Set<string>()
    const outputMaterials = new Set<string>()
    const intermediateMaterials = new Set<string>()

    // Process input statements to categorize materials
    const allSubjects = new Set(inputStatements.map((s) => s.subject))
    const allObjects = new Set(inputStatements.map((s) => s.object))

    inputStatements.forEach((statement) => {
      const subjectUuid = statement.subject
      const objectUuid = statement.object

      // Classify based on role in the flow:
      // - Pure inputs: appear as subject but never as object
      // - Pure outputs: appear as object but never as subject
      // - Intermediate: appear as both subject and object

      if (!allObjects.has(subjectUuid)) {
        // Subject never appears as object = pure input
        inputMaterials.add(subjectUuid)
      } else {
        // Subject also appears as object = intermediate
        intermediateMaterials.add(subjectUuid)
      }

      if (!allSubjects.has(objectUuid)) {
        // Object never appears as subject = pure output
        outputMaterials.add(objectUuid)
      } else {
        // Object also appears as subject = intermediate
        intermediateMaterials.add(objectUuid)
      }
    })

    // Clean up overlaps - intermediate takes precedence over input/output
    // This ensures materials that serve multiple roles are classified as intermediate
    intermediateMaterials.forEach((uuid) => {
      inputMaterials.delete(uuid)
      outputMaterials.delete(uuid)
    })

    // Get all materials that participate in relationships
    const allParticipatingMaterials = new Set([
      ...inputMaterials,
      ...outputMaterials,
      ...intermediateMaterials,
    ])

    // Convert objects to MaterialObject format with proper typing
    // Only include objects that participate in relationships
    const materials = realObjects
      .filter((obj) => allParticipatingMaterials.has(obj.uuid))
      .map((obj): MaterialObject => {
        let type: 'input' | 'output' | 'intermediate' = 'intermediate'
        let color = '#f5f5f5'

        if (inputMaterials.has(obj.uuid)) {
          type = 'input'
          color = '#1976d2'
        } else if (outputMaterials.has(obj.uuid)) {
          type = 'output'
          color = '#4caf50'
        }

        return {
          uuid: obj.uuid,
          name: obj.name || 'Unnamed Object',
          type,
          category: obj.description || 'Uncategorized',
          color,
        }
      })

    // Convert statements to MaterialRelationship format
    // Use a Map to deduplicate relationships by unique key
    const relationshipMap = new Map<string, MaterialRelationship>()

    inputStatements.forEach((statement) => {
      const subjectObj = objectMap.get(statement.subject)
      const objectObj = objectMap.get(statement.object)

      // Use shared processing logic
      const processed = processRelationshipStatement(statement)

      // Skip relationships with missing objects to avoid "Unknown" entries
      if (!subjectObj || !objectObj) {
        console.warn('Skipping relationship with missing objects:', {
          subject: statement.subject,
          object: statement.object,
          subjectExists: !!subjectObj,
          objectExists: !!objectObj,
          processName: processed.processName,
        })
        return
      }

      // Skip relationships with invalid process names
      if (!processed.isValid) {
        console.warn('Skipping relationship with invalid process name:', {
          subject: subjectObj.name,
          object: objectObj.name,
          processName: processed.processName,
        })
        return
      }

      // Create a unique key for deduplication
      const uniqueKey = `${statement.subject}-${statement.object}-${processed.processName}-${processed.quantity}-${processed.unit}`

      // Only add if not already exists (deduplication)
      if (!relationshipMap.has(uniqueKey)) {
        relationshipMap.set(uniqueKey, {
          predicate: 'IS_INPUT_OF' as const, // Normalize to IS_INPUT_OF for visualization
          subject: {
            uuid: statement.subject,
            name: subjectObj.name || 'Unnamed Object',
          },
          object: {
            uuid: statement.object,
            name: objectObj.name || 'Unnamed Object',
          },
          quantity: processed.quantity,
          unit: processed.unit,
          processName: processed.processName,
        })
      }
    })

    const relationships = Array.from(relationshipMap.values())

    return { materials, relationships }
  }, [enabled, inputStatements, realObjects])
}
