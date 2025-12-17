import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  UUObjectDTO,
  ComplexObjectCreationInput,
  ComplexObjectOutput,
  UUID,
  QueryParams,
} from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'

export function useObjects() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all objects using the new unified API
  const useAllObjects = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['objects', queryParams],
      queryFn: async () => {
        const response = await client.objects.getObjects({
          softDeleted: false,
          ...queryParams,
        })
        return response.data
      },
      enabled,
    })
  }

  // Get objects by specific UUID (returns array but should contain single object)
  const useObject = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['object', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.objects.getObjects({ uuid })
        // Since API returns array, get the first object
        return response.data?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
    })
  }

  // Get multiple objects by UUIDs efficiently (for name resolution, etc.)
  // includeDeleted: false will filter out soft-deleted objects and handle duplicates by taking the latest version
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
      ], // Include includeDeleted in cache key
      queryFn: async () => {
        if (!uuids.length) return []

        // Filter out empty/invalid UUIDs and deduplicate
        const validUuids = Array.from(new Set(uuids.filter(Boolean)))
        if (!validUuids.length) return []

        // Use Promise.all to fetch all objects in parallel
        const responses = await Promise.all(
          validUuids.map((uuid) =>
            client.objects
              .getObjects({
                uuid,
                softDeleted: options?.includeDeleted ?? true, // Default to true for backward compatibility
              })
              .catch(() => ({ data: [] }))
          )
        )

        // Flatten results
        let objects = responses.flatMap((response) => response.data || [])

        // If not including deleted, filter them out and handle duplicates by taking latest
        if (!options?.includeDeleted) {
          // Group by UUID to handle potential duplicates
          const objectsByUuid = new Map<string, any[]>()

          objects.forEach((obj: any) => {
            if (!objectsByUuid.has(obj.uuid)) {
              objectsByUuid.set(obj.uuid, [])
            }
            objectsByUuid.get(obj.uuid)!.push(obj)
          })

          // For each UUID, take the latest non-deleted object, or if all are deleted, take the latest
          objects = Array.from(objectsByUuid.entries()).map(
            ([uuid, versions]) => {
              // First try to find non-deleted versions
              const nonDeleted = versions.filter((v: any) => !v.softDeleted)

              if (nonDeleted.length > 0) {
                // Return the latest non-deleted version
                return nonDeleted.sort(
                  (a: any, b: any) =>
                    new Date(b.updatedAt || b.createdAt || 0).getTime() -
                    new Date(a.updatedAt || a.createdAt || 0).getTime()
                )[0]
              } else {
                // All are deleted, return the latest deleted version
                return versions.sort(
                  (a: any, b: any) =>
                    new Date(b.updatedAt || b.createdAt || 0).getTime() -
                    new Date(a.updatedAt || a.createdAt || 0).getTime()
                )[0]
              }
            }
          )
        }

        return objects
      },
      enabled: uuids.length > 0 && options?.enabled !== false,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes since names don't change often
    })
  }

  // Create object mutation - using new simplified method
  const useCreateObject = () => {
    return useMutation({
      mutationFn: async (object: UUObjectDTO) => {
        const response = await client.objects.create(object)
        return response.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['objects'] })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  // Create full object mutation - keep high-level method
  const useCreateFullObject = () => {
    return useMutation({
      mutationFn: async (objectData: ComplexObjectCreationInput) => {
        const response = await client.objects.createFullObject(objectData)
        return response.data
      },
      onSuccess: (data: ComplexObjectOutput | null) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['objects'] })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })

        if (data?.object?.uuid) {
          queryClient.invalidateQueries({
            queryKey: ['object', data.object.uuid],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.object.uuid, 'withProperties'],
          })
          queryClient.invalidateQueries({
            queryKey: ['aggregate', data.object.uuid],
          })
        }

        // According to the ComplexObjectOutput type, there may be a parent property
        if (data?.parents?.length && data.parents.length > 0) {
          data.parents.forEach((parent) => {
            queryClient.invalidateQueries({
              queryKey: ['object', parent],
            })
            queryClient.invalidateQueries({
              queryKey: ['object', parent, 'children'],
            })
            queryClient.invalidateQueries({
              queryKey: ['aggregate', parent],
            })
          })
        }
      },
    })
  }

  // Update object metadata only - using create method (which handles updates)
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
        // Use the create method which handles both create and update
        const response = await client.objects.create({
          uuid,
          name,
          abbreviation,
          version,
          description,
        })
        return response.data
      },
      onSuccess: (data) => {
        if (data?.uuid) {
          // Invalidate just the object queries, not the entire objects collection
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'withProperties'],
          })
          queryClient.invalidateQueries({
            queryKey: ['object', data.uuid, 'full'],
          })

          // Also invalidate aggregate queries to refresh table/explorer views
          queryClient.invalidateQueries({ queryKey: ['aggregates'] })
          queryClient.invalidateQueries({ queryKey: ['aggregate', data.uuid] })
        }
      },
    })
  }

  // Delete object mutation - using new simplified method
  const useDeleteObject = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.objects.delete(uuid)
        return response.data
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({ queryKey: ['objects'] })
        // Don't remove queries since soft delete keeps the object
        queryClient.invalidateQueries({ queryKey: ['object', deletedUuid] })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['aggregate', deletedUuid] })
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
        // Use the create method to revert - this will restore the object
        const response = await client.objects.create({
          uuid,
          name,
          abbreviation,
          version,
          description,
          isTemplate,
        })
        return response.data
      },
      onSuccess: (data) => {
        if (data?.uuid) {
          // Invalidate all relevant queries to refresh the UI
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
          queryClient.invalidateQueries({ queryKey: ['aggregate', data.uuid] })
        }
      },
    })
  }

  return {
    useAllObjects,
    useObject,
    useObjectsByUUIDs,
    useCreateObject,
    useCreateFullObject,
    useUpdateObjectMetadata,
    useDeleteObject,
    useRevertObject,
  }
}
