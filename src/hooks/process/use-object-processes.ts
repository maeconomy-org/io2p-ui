import { useMemo } from 'react'

import { useStatements, useObjects } from '@/hooks'

interface UseObjectProcessesProps {
  objectUuid?: string
}

interface ProcessRelationship {
  processName: string
  quantity: number
  unit: string
  inputObjectUuid: string
  inputObjectName: string
  outputObjectUuid: string
  outputObjectName: string
}

interface ObjectProcessesResult {
  createdBy: ProcessRelationship[]
  usedIn: ProcessRelationship[]
  isLoading: boolean
}

/**
 * Lightweight hook specifically for ProcessesTab
 * Only fetches and processes what's needed for process relationship display
 */
export function useObjectProcesses({
  objectUuid,
}: UseObjectProcessesProps): ObjectProcessesResult {
  const { useObjectRelationships } = useStatements()
  const { useObjectsByUUIDs } = useObjects()

  // Fetch relationships for this specific object
  const { data: relationshipsData, isLoading: relationshipsLoading } =
    useObjectRelationships(objectUuid || '', {
      enabled: !!objectUuid,
      predicate: 'IS_INPUT_OF',
      includeDeleted: false,
    })

  // Extract unique object UUIDs for name resolution
  const objectUuids = useMemo(() => {
    if (!relationshipsData) return []

    const uuids = new Set<string>()
    relationshipsData.asSubject?.forEach((rel) => {
      uuids.add(rel.subject)
      uuids.add(rel.object)
    })
    relationshipsData.asObject?.forEach((rel) => {
      uuids.add(rel.subject)
      uuids.add(rel.object)
    })

    return Array.from(uuids)
  }, [relationshipsData])

  // Fetch only the objects we need for names (exclude soft-deleted to avoid duplicates)
  const { data: objects, isLoading: objectsLoading } = useObjectsByUUIDs(
    objectUuids,
    { includeDeleted: false }
  )

  // Process relationships into ProcessesTab format
  const processedRelationships = useMemo(() => {
    if (!relationshipsData || !objects || !objectUuid) {
      return { createdBy: [], usedIn: [] }
    }

    // Create name lookup map
    const nameMap = new Map<string, string>()
    objects.forEach((obj) => {
      if (obj.uuid && obj.name) {
        nameMap.set(obj.uuid, obj.name)
      }
    })

    const getObjectName = (uuid: string) =>
      nameMap.get(uuid) || `Object ${uuid.slice(-8)}`

    // Helper to extract properties
    const getPropertyValue = (statement: any, key: string) => {
      const property = statement.properties?.find((p: any) => p.key === key)
      return property?.values?.[0]?.value || null
    }

    const createdBy: ProcessRelationship[] = []
    const usedIn: ProcessRelationship[] = []

    // Process "created by" relationships (this object is output)
    relationshipsData.asObject?.forEach((rel) => {
      const processName = getPropertyValue(rel, 'processName')
      if (!processName || processName.trim() === '') return

      createdBy.push({
        processName,
        quantity: parseFloat(getPropertyValue(rel, 'quantity') || '0'),
        unit: getPropertyValue(rel, 'unit') || '',
        inputObjectUuid: rel.subject,
        inputObjectName: getObjectName(rel.subject),
        outputObjectUuid: rel.object,
        outputObjectName: getObjectName(rel.object),
      })
    })

    // Process "used in" relationships (this object is input)
    relationshipsData.asSubject?.forEach((rel) => {
      const processName = getPropertyValue(rel, 'processName')
      if (!processName || processName.trim() === '') return

      usedIn.push({
        processName,
        quantity: parseFloat(getPropertyValue(rel, 'quantity') || '0'),
        unit: getPropertyValue(rel, 'unit') || '',
        inputObjectUuid: rel.subject,
        inputObjectName: getObjectName(rel.subject),
        outputObjectUuid: rel.object,
        outputObjectName: getObjectName(rel.object),
      })
    })

    return { createdBy, usedIn }
  }, [relationshipsData, objects, objectUuid])

  return {
    ...processedRelationships,
    isLoading: relationshipsLoading || objectsLoading,
  }
}
