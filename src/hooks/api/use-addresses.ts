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
        address,
      }: {
        address: Omit<UUAddressDTO, 'uuid'>
      }) => {
        const response = await client.node.createAddress(address)

        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['aggregate'] })
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
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        queryClient.invalidateQueries({ queryKey: ['address', data?.uuid] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['aggregate'] })
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
        queryClient.invalidateQueries({ queryKey: ['addresses'] })
        queryClient.removeQueries({ queryKey: ['address', deletedUuid] })
        // Also invalidate related object queries since addresses are linked to objects
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['aggregate'] })
      },
    })
  }

  return {
    useCreateAddress,
    useUpdateAddress,
    useDeleteAddress,
  }
}
