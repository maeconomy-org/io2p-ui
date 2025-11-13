import { useMemo } from 'react'
import { useViewData } from '@/hooks'
import type { ParentObject } from '@/types'

/**
 * Hook for looking up parent object details from UUIDs
 * Used during object creation/editing to enrich UUID strings with object names
 */
export function useParentLookup(parentUuids: string[]): ParentObject[] {
  const viewData = useViewData({ viewType: 'table' })
  const availableObjects = 'data' in viewData ? viewData.data || [] : []

  return useMemo(() => {
    if (!parentUuids || parentUuids.length === 0) {
      return []
    }

    return parentUuids
      .filter((uuid) => uuid && typeof uuid === 'string')
      .map((uuid): ParentObject => {
        const foundObject = availableObjects.find(
          (obj: any) => obj.uuid === uuid
        )

        if (foundObject) {
          return {
            uuid: foundObject.uuid,
            name: foundObject.name || foundObject.uuid, // Fallback to UUID if no name
            description: foundObject.description,
          }
        }

        // Return minimal info if object not found in current data
        // This shows just the UUID since we don't have the full object data
        return {
          uuid,
          name: `Object: ${uuid.slice(0, 8)}...`, // Show truncated UUID for readability
        }
      })
  }, [parentUuids, availableObjects])
}
