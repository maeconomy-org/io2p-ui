import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AggregateFindDTO } from 'iom-sdk'

import { useIomSdkClient } from '@/providers/query-provider'
import { useAuth } from '@/contexts/auth-context'

export function useAggregate() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const { userUUID } = useAuth()

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
          // isTemplate: true,
        })
        return response.data
      },
      ...options,
    })
  }

  // Get all aggregate entities without pagination
  const useAllAggregateEntities = (options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'all'],
      queryFn: async () => {
        const response = await client.aggregate.getAggregateEntities({
          page: 0,
          size: 1000, // Large size to get most entities
        })
        return response.data
      },
      ...options,
    })
  }

  // Get aggregate entities for current user
  const useUserAggregateEntities = (options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'user'],
      queryFn: async () => {
        const response = await client.aggregate.getAggregateEntities({
          page: 0,
          size: 1000,
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

  // Create aggregate object
  const useCreateAggregateObject = () => {
    return useMutation({
      mutationFn: async (aggregateEntityList: any[]) => {
        if (!userUUID) {
          throw new Error('User UUID is required for aggregate creation')
        }

        // Wrap the data with user info as required by the new API structure
        const payload = {
          aggregateEntityList,
          user: {
            userUUID,
          },
        }

        const response = await client.aggregate.createAggregateObject(payload)
        return response.data
      },
      onSuccess: () => {
        // Invalidate aggregate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['objects'] })
      },
    })
  }

  // Import aggregate objects
  const useImportAggregateObjects = () => {
    return useMutation({
      mutationFn: async (aggregateEntityList: any[]) => {
        if (!userUUID) {
          throw new Error('User UUID is required for aggregate import')
        }

        // Wrap the data with user info as required by the new API structure
        const payload = {
          aggregateEntityList,
          user: {
            userUUID,
          },
        }

        const response = await client.aggregate.importAggregateObjects(payload)
        return response.data
      },
      onSuccess: () => {
        // Invalidate aggregate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['objects'] })
      },
    })
  }

  return {
    useAggregateByUUID,
    useAggregateEntities,
    useModelEntities,
    useAllAggregateEntities,
    useUserAggregateEntities,
    useAggregateEntitiesWithHistory,
    useCreateAggregateObject,
    useImportAggregateObjects,
  }
}
