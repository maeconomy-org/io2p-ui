import { useMemo } from 'react'
import { useAggregate } from '@/hooks'
import { mapAggregateResponseToFormulaData } from '@/components/properties/utils/formula-mapping'

export interface ObjectDataHookProps {
  uuid?: string
  initialObject?: any
  isOpen: boolean
  hasHistory?: boolean
}

export interface ObjectDataHookReturn {
  object: any | null
  aggregate: any | null
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
  hasHistory = false,
}: ObjectDataHookProps): ObjectDataHookReturn {
  const { useAggregateByUUID, useAggregateByUUIDWithHistory } = useAggregate()

  // Fetch the aggregate object details if a UUID is provided.
  // We call both hooks unconditionally (rules of hooks) but only enable the
  // one that matches the requested shape — history payloads are large, so
  // we defer the history-flavoured fetch until the history tab is opened.
  const baseQuery = useAggregateByUUID(uuid || '', {
    enabled: !!uuid && isOpen && !hasHistory,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  const historyQuery = useAggregateByUUIDWithHistory(uuid || '', {
    enabled: !!uuid && isOpen && hasHistory,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  const aggregateData = hasHistory ? historyQuery.data : baseQuery.data
  const isLoading = hasHistory ? historyQuery.isLoading : baseQuery.isLoading
  const refetchAggregate = hasHistory ? historyQuery.refetch : baseQuery.refetch

  // Process aggregate data to get the object details in the expected format
  const { object, aggregate, properties, files, objectHistory, addressInfo } =
    useMemo(() => {
      const source = aggregateData || initialObject

      if (!source) {
        return {
          object: null,
          aggregate: null,
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

      // Enrich properties with formula data from aggregate mathFormulas
      const rawProperties = (source.properties || [])
        .filter((prop: any) => !prop.softDeleted)
        .map((prop: any) => ({
          ...prop,
          values: (prop.values || []).filter((val: any) => !val.softDeleted),
        }))

      const mathFormulas = source.mathFormulas || []
      let enrichedProperties = rawProperties

      if (mathFormulas.length > 0) {
        // Build a map from result propertyValueUUID → formulaData
        const formulaDataByValueUUID = new Map<string, any>()
        for (const mf of mathFormulas) {
          const resultUUID = mf.mathFormulaCalc?.result?.propertyValueUUID
          if (resultUUID) {
            const formulaData = mapAggregateResponseToFormulaData(mf, source)
            if (formulaData) {
              formulaDataByValueUUID.set(resultUUID, {
                ...formulaData,
                calcUuid: mf.mathFormulaCalc?.uuid,
              })
            }
          }
        }

        // Attach formulaData to matching property values
        if (formulaDataByValueUUID.size > 0) {
          enrichedProperties = rawProperties.map((prop: any) => ({
            ...prop,
            values: prop.values.map((val: any) => {
              const formulaData = val.uuid
                ? formulaDataByValueUUID.get(val.uuid)
                : undefined
              return formulaData ? { ...val, formulaData } : val
            }),
          }))
        }
      }

      return {
        aggregate: source,
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
        properties: enrichedProperties,
        files: source.files || [],
        objectHistory: [],
        addressInfo,
      }
    }, [aggregateData, initialObject])

  return {
    object,
    aggregate,
    properties,
    files,
    objectHistory,
    addressInfo,
    isLoading,
    refetchAggregate,
  }
}
