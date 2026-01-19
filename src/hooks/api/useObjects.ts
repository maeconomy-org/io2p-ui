import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUObjectDTO, UUID, QueryParams } from 'iom-sdk'
import { useSDKStore, sdkSelectors } from '@/stores'

export function useObjects() {
  const client = useSDKStore(sdkSelectors.client)
  const queryClient = useQueryClient()

  if (!client) {
    throw new Error(
      'SDK client not initialized. Make sure to call initializeClient first.'
    )
  }

  // Get all objects using the unified API
  const useAllObjects = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['objects', queryParams],
      queryFn: async () => {
        const response = await client.node.getObjects({
          softDeleted: false,
          ...queryParams,
        })
        return response
      },
      enabled,
    })
  }

  // Get objects by specific UUID
  const useObject = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['object', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.node.getObjects({ uuid })
        return response?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
    })
  }

  // Get multiple objects by UUIDs efficiently
  const useObjectsByUUIDs = (
    uuids: string[],
    options?: { enabled?: boolean; includeDeleted?: boolean }
  ) => {
    return useQuery({
      queryKey: [
        'objects',
        'byUUIDs',
        uuids.sort(),
        options?.includeDeleted ?? true,
      ],
      queryFn: async () => {
        if (!uuids.length) return []

        const validUuids = Array.from(new Set(uuids.filter(Boolean)))
        if (!validUuids.length) return []

        const responses = await Promise.all(
          validUuids.map((uuid) =>
            client.node
              .getObjects({
                uuid,
                softDeleted: options?.includeDeleted ?? true,
              })
              .catch(() => [])
          )
        )

        let objects = responses.flatMap((response) => response || [])

        if (!options?.includeDeleted) {
          const objectsByUuid = new Map<string, any[]>()

          objects.forEach((obj: any) => {
            if (!objectsByUuid.has(obj.uuid)) {
              objectsByUuid.set(obj.uuid, [])
            }
            objectsByUuid.get(obj.uuid)!.push(obj)
          })

          objects = Array.from(objectsByUuid.entries()).map(([, versions]) => {
            const nonDeleted = versions.filter((v: any) => !v.softDeleted)

            if (nonDeleted.length > 0) {
              return nonDeleted.sort(
                (a: any, b: any) =>
                  new Date(b.updatedAt || b.createdAt || 0).getTime() -
                  new Date(a.updatedAt || a.createdAt || 0).getTime()
              )[0]
            } else {
              return versions.sort(
                (a: any, b: any) =>
                  new Date(b.updatedAt || b.createdAt || 0).getTime() -
                  new Date(a.updatedAt || a.createdAt || 0).getTime()
              )[0]
            }
          })
        }

        return objects
      },
      enabled: uuids.length > 0 && options?.enabled !== false,
      staleTime: 5 * 60 * 1000,
    })
  }

  // Create object mutation
  const useCreateObject = () => {
    return useMutation({
      mutationFn: async (object: UUObjectDTO) => {
        const response = await client.node.createObject(object)
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Update object metadata
  const useUpdateObjectMetadata = () => {
    return useMutation({
      mutationFn: async ({
        uuid,
        name,
        abbreviation,
        version,
        description,
      }: {
        uuid: UUID
        name?: string
        abbreviation?: string
        version?: string
        description?: string
      }) => {
        // Use createObject for updates (this creates a new version)
        const response = await client.node.updateObject({
          uuid,
          name,
          abbreviation,
          version,
          description,
        })
        return response
      },
      onSuccess: (data) => {
        if (data?.uuid) {
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'withProperties'],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'full'],
          })
          queryClient.invalidateQueries({ queryKey: ['aggregates'] })
          queryClient.invalidateQueries({
            queryKey: ['aggregate', data.uuid],
          })
        }
      },
    })
  }

  // Delete object mutation
  const useDeleteObject = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.node.softDeleteObject(uuid)
        return response
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        queryClient.invalidateQueries({ queryKey: ['object', deletedUuid] })
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({
          queryKey: ['aggregate', deletedUuid],
        })
      },
    })
  }

  // Revert soft-deleted object mutation
  const useRevertObject = () => {
    return useMutation({
      mutationFn: async ({
        uuid,
        name,
        abbreviation,
        version,
        description,
        isTemplate,
      }: {
        uuid: UUID
        name: string
        abbreviation?: string
        version?: string
        description?: string
        isTemplate?: boolean
      }) => {
        // Use createObject for revert (this creates a new version)
        const response = await client.node.updateObject({
          uuid,
          name,
          abbreviation,
          version,
          description,
          isTemplate,
        })
        return response
      },
      onSuccess: (data) => {
        if (data?.uuid) {
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'withProperties'],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'full'],
          })
          queryClient.invalidateQueries({ queryKey: ['objects'] })
          queryClient.invalidateQueries({ queryKey: ['aggregates'] })
          queryClient.invalidateQueries({
            queryKey: ['aggregate', data.uuid],
          })
        }
      },
    })
  }

  return {
    useAllObjects,
    useObject,
    useObjectsByUUIDs,
    useCreateObject,
    useUpdateObjectMetadata,
    useDeleteObject,
    useRevertObject,
  }
}
