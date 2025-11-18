import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUAddressDTO } from 'iom-sdk'

import { useIomSdkClient } from '@/contexts'

export function useAddresses() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Create address mutation
  const useCreateAddress = () => {
    return useMutation({
      mutationFn: async ({
        objectUuid,
        address,
      }: {
        objectUuid: string
        address: Omit<UUAddressDTO, 'uuid'>
      }) => {
        const response = await client.addresses.createForObject(
          objectUuid,
          address as any
        )

        return response.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Update address mutation
  const useUpdateAddress = () => {
    return useMutation({
      mutationFn: async (address: UUAddressDTO & { uuid: string }) => {
        const response = await client.addresses.update(address)
        return response.data
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        queryClient.invalidateQueries({ queryKey: ['address', data?.uuid] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Delete address mutation
  const useDeleteAddress = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.addresses.delete(uuid)
        return response.data
      },
      onSuccess: (_, deletedUuid) => {
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        queryClient.removeQueries({ queryKey: ['address', deletedUuid] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  return {
    useCreateAddress,
    useUpdateAddress,
    useDeleteAddress,
  }
}
