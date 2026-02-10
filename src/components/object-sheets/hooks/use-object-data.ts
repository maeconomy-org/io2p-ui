import { useMemo } from 'react'
import { useAggregate } from '@/hooks'

export interface ObjectDataHookProps {
  uuid?: string
  initialObject?: any
  isOpen: boolean
}

export interface ObjectDataHookReturn {
  object: any | null
  properties: any[]
  files: any[]
  objectHistory: any[]
  addressInfo: any | null
  isLoading: boolean
  refetchAggregate?: () => void
}

/**
 * Hook for managing object data with support for both initial object and UUID-based fetching
 * Handles the pattern where we might have initial object data or need to fetch via aggregate API
 */
export function useObjectData({
  uuid,
  initialObject,
  isOpen,
}: ObjectDataHookProps): ObjectDataHookReturn {
  const { useAggregateByUUID } = useAggregate()

  // Fetch the aggregate object details if a UUID is provided
  // This provides much richer data including all relationships, properties, and files
  const {
    data: aggregateData,
    isLoading,
    refetch: refetchAggregate,
  } = useAggregateByUUID(uuid || '', {
    enabled: !!uuid && isOpen, // Enable for both cases but will only fetch when needed
    refetchOnWindowFocus: false,
    staleTime: 0, // Always consider data stale so it refetches when invalidated
  })

  // Process aggregate data to get the object details in the expected format
  const { object, properties, files, objectHistory, addressInfo } =
    useMemo(() => {
      const source = aggregateData || initialObject

      if (!source) {
        return {
          object: null,
          properties: [],
          files: [],
          objectHistory: [],
          addressInfo: null,
        }
      }

      const address = (source as any).address
      const addressInfo = address
        ? {
            uuid: address.uuid || '',
            fullAddress: address.fullAddress || '',
            street: address.street || '',
            houseNumber: address.houseNumber || '',
            city: address.city || '',
            postalCode: address.postalCode || '',
            country: address.country || '',
            state: address.state || '',
            district: address.district || '',
          }
        : null

      return {
        object: {
          uuid: source.uuid || '',
          name: source.name || '',
          abbreviation: source.abbreviation || '',
          version: source.version || '',
          description: source.description || '',
          createdAt: source.createdAt || '',
          lastUpdatedAt: source.lastUpdatedAt || '',
          softDeleted: source.softDeleted || false,
          softDeletedAt: source.softDeletedAt || '',
          softDeleteBy: source.softDeleteBy || '',
          parents: source.parents || [],
          ...(source.modelUuid && { modelUuid: source.modelUuid }),
        },
        properties: (source.properties || []).filter(
          (prop: any) => !prop.softDeleted
        ),
        files: source.files || [],
        objectHistory: [],
        addressInfo,
      }
    }, [aggregateData, initialObject])

  return {
    object,
    properties,
    files,
    objectHistory,
    addressInfo,
    isLoading,
    refetchAggregate,
  }
}
