import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { GroupCreateDTO, GroupAddRecordsDTO, UUID } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'

export function useGroups() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  const useListGroups = (options = {}) => {
    return useQuery({
      queryKey: ['groups'],
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
      queryKey: ['groups', groupUUID],
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
      queryKey: ['groups', groupUUID, 'records'],
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
        queryClient.invalidateQueries({ queryKey: ['groups'] })
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
          queryKey: ['groups', variables.groupUUID, 'records'],
        })
        queryClient.invalidateQueries({ queryKey: ['groups'] })
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
