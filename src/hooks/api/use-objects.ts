import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUObjectDTO, UUID, QueryParams } from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useObjects() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all objects using the unified API
  const useAllObjects = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: queryKeys.objects.list(queryParams),
      queryFn: async () => {
        const response = await client.node.getObjects({
          softDeleted: false,
          ...queryParams,
        })
        return response
      },
      enabled,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Get objects by specific UUID
  const useObject = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: queryKeys.objects.detail(uuid),
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.node.getObjects({ uuid })
        return response?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Get multiple objects by UUIDs efficiently
  const useObjectsByUUIDs = (
    uuids: string[],
    options?: { enabled?: boolean; includeDeleted?: boolean }
  ) => {
    return useQuery({
      queryKey: queryKeys.objects.byUUIDs(uuids, options?.includeDeleted),
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

        // API may return extra fields beyond UUObjectDTO (softDeleted, timestamps)
        type ObjectWithMeta = UUObjectDTO & {
          softDeleted?: boolean
          updatedAt?: string
          createdAt?: string
        }

        let objects: ObjectWithMeta[] = responses.flatMap(
          (response) => (response || []) as ObjectWithMeta[]
        )

        if (!options?.includeDeleted) {
          const objectsByUuid = new Map<string, ObjectWithMeta[]>()

          objects.forEach((obj) => {
            const key = obj.uuid ?? ''
            if (!objectsByUuid.has(key)) {
              objectsByUuid.set(key, [])
            }
            objectsByUuid.get(key)!.push(obj)
          })

          objects = Array.from(objectsByUuid.entries()).map(([, versions]) => {
            const nonDeleted = versions.filter((v) => !v.softDeleted)
            const sortByDate = (a: ObjectWithMeta, b: ObjectWithMeta) =>
              new Date(b.updatedAt || b.createdAt || 0).getTime() -
              new Date(a.updatedAt || a.createdAt || 0).getTime()

            return nonDeleted.length > 0
              ? nonDeleted.sort(sortByDate)[0]
              : versions.sort(sortByDate)[0]
          })
        }

        return objects
      },
      enabled: uuids.length > 0 && options?.enabled !== false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })
  }

  // Create object mutation
  const useCreateObject = () => {
    return useMutation({
      mutationFn: async (object: UUObjectDTO) => {
        const response = await client.node.createOrUpdateObject(object)
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
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
        isTemplate,
      }: {
        uuid: UUID
        name?: string
        abbreviation?: string
        version?: string
        description?: string
        isTemplate?: boolean
      }) => {
        // Use createObject for updates (this creates a new version)
        const response = await client.node.createOrUpdateObject({
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
            queryKey: queryKeys.objects.detail(data.uuid),
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.aggregates.detail(data.uuid),
          })
        }
        // Broad invalidation: template updates need to refresh the models query
        // as well (`queryKeys.aggregates.models(...)`), not just list queries.
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.all,
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
        })
      },
    })
  }

  // Delete object mutation
  const useDeleteObject = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        await client.node.softDeleteObject(uuid)
        return uuid
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.detail(deletedUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.detail(deletedUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.all,
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.all,
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
        const response = await client.node.createOrUpdateObject({
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
            queryKey: queryKeys.objects.detail(data.uuid),
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.aggregates.detail(data.uuid),
          })
        }
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
    useAllObjects,
    useObject,
    useObjectsByUUIDs,
    useCreateObject,
    useUpdateObjectMetadata,
    useDeleteObject,
    useRevertObject,
  }
}
