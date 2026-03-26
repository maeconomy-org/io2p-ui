import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { GroupCreateDTO, GroupAddRecordsDTO, UUID } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useGroups() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  const useListGroups = (options = {}) => {
    return useQuery({
      queryKey: queryKeys.groups.list(),
      queryFn: async () => {
        return client.node.listGroups()
      },
      staleTime: 60000, // Groups rarely change — cache for 1 minute
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      ...options,
    })
  }

  const useGetGroup = (groupUUID: UUID, options = {}) => {
    return useQuery({
      queryKey: queryKeys.groups.detail(groupUUID),
      queryFn: async () => {
        return client.node.getGroup(groupUUID)
      },
      enabled: !!groupUUID,
      staleTime: 60000,
      gcTime: 10 * 60 * 1000,
      ...options,
    })
  }

  const useListGroupRecords = (groupUUID: UUID, options = {}) => {
    return useQuery({
      queryKey: queryKeys.groups.records(groupUUID),
      queryFn: async () => {
        return client.node.listGroupRecords(groupUUID)
      },
      enabled: !!groupUUID,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      ...options,
    })
  }

  const useCreateGroup = () => {
    return useMutation({
      mutationFn: async (group: GroupCreateDTO) => {
        return client.node.createGroup(group)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.all,
        })
      },
    })
  }

  const useAddGroupRecords = () => {
    return useMutation({
      mutationFn: async ({
        groupUUID,
        records,
      }: {
        groupUUID: UUID
        records: GroupAddRecordsDTO
      }) => {
        return client.node.addGroupRecords(groupUUID, records)
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.records(variables.groupUUID),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.groups.lists(),
        })
      },
    })
  }

  return {
    useListGroups,
    useGetGroup,
    useListGroupRecords,
    useCreateGroup,
    useAddGroupRecords,
  }
}
