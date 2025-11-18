import { useQuery } from '@tanstack/react-query'
import type { AggregateFindDTO } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'

export function useAggregate() {
  const client = useIomSdkClient()

  // Get aggregate entity by UUID (rich data with all relationships)
  const useAggregateByUUID = (uuid: string, options = {}) => {
    return useQuery({
      queryKey: ['aggregate', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.aggregate.findByUUID(uuid)
        return response.data
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
        const response = await client.aggregate.getAggregateEntities(params)
        return response.data
      },
      ...options,
    })
  }

  const useModelEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'models', params],
      queryFn: async () => {
        const response = await client.aggregate.getAggregateEntities({
          ...params,
          // TODO: Uncomment when iom-sdk is updated
          // searchBy: {
          // isTemplate: true,
          // }
        })
        return response.data
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
        const response = await client.aggregate.getAggregateEntities({
          ...params,
          hasHistory: true,
        })
        return response.data
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
