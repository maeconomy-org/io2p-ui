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

        const response = await client.node.searchAggregates({
          accessFind: { readDefaultGroup: true },
          searchBy: { uuid },
          page: 0,
          size: 1,
        })
        return response.content?.[0] || null
      },
      enabled: !!uuid,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  // Get paginated aggregate entities (for tables/lists)
  const useAggregateEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', params],
      queryFn: async () => {
        const response = await client.node.searchAggregates({
          // readDefaultGroup: true,
          ...params,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
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

        const response = await client.node.searchAggregates({
          accessFind: { readDefaultGroup: true },
          ...searchParams,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
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

        const response = await client.node.searchAggregates({
          accessFind: { readDefaultGroup: true },
          ...searchParams,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  // Get aggregate entities from user's own groups
  const useOwnGroupEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'ownGroups', params],
      queryFn: async () => {
        const response = await client.node.searchAggregates({
          accessFind: { readOwnGroups: true },
          ...params,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  // Get aggregate entities from public groups
  const usePublicGroupEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'publicGroups', params],
      queryFn: async () => {
        const response = await client.node.searchAggregates({
          accessFind: { readPublicGroups: true },
          ...params,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  // Get aggregate entities from groups shared with the current user
  const useSharedGroupEntities = (params?: AggregateFindDTO, options = {}) => {
    return useQuery({
      queryKey: ['aggregates', 'sharedGroups', params],
      queryFn: async () => {
        const response = await client.node.searchAggregates({
          accessFind: { readUserSharedGroups: true },
          ...params,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  // Generic hook for fetching entities with custom group parameters
  const useGroupEntities = (
    groupParams: Pick<AggregateFindDTO, 'accessFind'>,
    params?: AggregateFindDTO,
    options = {}
  ) => {
    return useQuery({
      queryKey: ['aggregates', 'groups', groupParams, params],
      queryFn: async () => {
        const response = await client.node.searchAggregates({
          ...groupParams,
          ...params,
        })
        return response
      },
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  return {
    useAggregateByUUID,
    useAggregateEntities,
    useModelEntities,
    useAggregateEntitiesWithHistory,
    useOwnGroupEntities,
    usePublicGroupEntities,
    useSharedGroupEntities,
    useGroupEntities,
  }
}
