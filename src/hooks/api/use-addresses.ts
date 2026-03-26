import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUAddressDTO } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useAddresses() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Create address mutation
  const useCreateAddress = () => {
    return useMutation({
      mutationFn: async ({
        address,
      }: {
        address: Omit<UUAddressDTO, 'uuid'>
      }) => {
        const response = await client.node.createAddress(address)

        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.addresses.all,
        })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Update address mutation
  const useUpdateAddress = () => {
    return useMutation({
      mutationFn: async (address: UUAddressDTO & { uuid: string }) => {
        const response = await client.node.createOrUpdateAddress(address)
        return response
      },
      onSuccess: (data) => {
        if (data?.uuid) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.addresses.detail(data.uuid),
          })
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.addresses.all,
        })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Delete address mutation
  const useDeleteAddress = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.node.softDeleteAddress(uuid)
        return response
      },
      onSuccess: (_, deletedUuid) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.addresses.all,
        })
        queryClient.removeQueries({
          queryKey: queryKeys.addresses.detail(deletedUuid),
        })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  return {
    useCreateAddress,
    useUpdateAddress,
    useDeleteAddress,
  }
}
