import type { UUID } from 'iom-sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

import { useIomSdkClient } from '@/providers/query-provider'

export function useUuid() {
  const client = useIomSdkClient()

  // Generate a new UUID
  const useGenerateUuid = () => {
    return useMutation({
      mutationFn: async () => {
        const response = await client.uuid.create()
        return response.data?.uuid
      },
    })
  }

  // Get UUIDs owned by the current user (query, not mutation)
  const useOwnedUuids = (options = {}) => {
    return useQuery({
      queryKey: ['uuid', 'owned'],
      queryFn: async () => {
        const response = await client.uuid.getOwned()
        return response.data
      },
      ...options,
    })
  }

  // Get specific UUID record
  const useUuidRecord = (uuid: UUID, options = {}) => {
    return useQuery({
      queryKey: ['uuid', 'record', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.uuid.getRecord(uuid)
        return response.data
      },
      enabled: !!uuid,
      ...options,
    })
  }

  // Update UUID metadata
  const useUpdateUuidMeta = () => {
    return useMutation({
      mutationFn: async (params: { uuid: UUID; nodeType: string }) => {
        const response = await client.uuid.updateRecordMeta(params)
        return response.data
      },
    })
  }

  // Authorize UUID access
  const useAuthorizeUuid = () => {
    return useMutation({
      mutationFn: async (params: { userUUID: UUID; resourceId: UUID }) => {
        const response = await client.uuid.authorize(params)
        return response.data
      },
    })
  }

  return {
    useGenerateUuid,
    useOwnedUuids,
    useUuidRecord,
    useUpdateUuidMeta,
    useAuthorizeUuid,
  }
}
