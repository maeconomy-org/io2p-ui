import { useQuery } from '@tanstack/react-query'
import type { AggregateFindDTO } from 'iom-sdk'

import { useSDKStore, sdkSelectors } from '@/stores'

export function useAggregate() {
  const client = useSDKStore(sdkSelectors.client)

  // Get aggregate entity by UUID (rich data with all relationships)
  const useAggregateByUUID = (uuid: string, options = {}) => {
    return useQuery({
      queryKey: ['aggregate', uuid],
      queryFn: async () => {
        if (!uuid) return null

        const response = await client.node.searchAggregates({
          searchBy: { uuid },
          page: 0,
          size: 1,
        })
        return response.content?.[0] || null
      },
      enabled: !!uuid,
      ...options,
    })
  }

  // Get paginated aggregate entities (for tables/lists)
  const useAggregateEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', params],
      queryFn: async () => {
        const response = await client.node.searchAggregates(params)
        return response
      },
      ...options,
    })
  }

  const useModelEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'models', params],
      queryFn: async () => {
        const searchParams = {
          ...params,
          searchBy: {
            ...params?.searchBy,
            isTemplate: true,
          },
        }

        const response = await client.node.searchAggregates(searchParams)
        return response
      },
      ...options,
    })
  }

  // Get aggregate entities with history
  const useAggregateEntitiesWithHistory = (
    params?: AggregateFindDTO,
    options = {}
  ) => {
    return useQuery({
      queryKey: ['aggregates', 'withHistory', params],
      queryFn: async () => {
        const searchParams = {
          ...params,
          hasHistory: true,
        }

        const response = await client.node.searchAggregates(searchParams)
        return response
      },
      ...options,
    })
  }

  return {
    useAggregateByUUID,
    useAggregateEntities,
    useModelEntities,
    useAggregateEntitiesWithHistory,
  }
}
