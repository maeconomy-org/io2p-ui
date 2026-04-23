import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUPropertyDTO, UUPropertyValueDTO, QueryParams } from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useProperties() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all properties using the unified API
  const useAllProperties = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: queryKeys.properties.list(queryParams),
      queryFn: async () => {
        const response = await client.node.getProperties({
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

  // Get property by UUID
  const useProperty = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: queryKeys.properties.detail(uuid),
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.node.getProperties({ uuid })
        return response?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
    })
  }

  // Create property mutation
  const useCreateProperty = () => {
    return useMutation({
      mutationFn: async (property: UUPropertyDTO) => {
        const response = await client.node.createProperty(property)
        return response
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Update property mutation (updates property metadata like key/name)
  const useUpdateProperty = () => {
    return useMutation({
      mutationFn: async (property: UUPropertyDTO) => {
        const response = await client.node.createOrUpdateProperty(property)
        return response
      },
      onSuccess: (_, property) => {
        if (property.uuid) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.properties.detail(property.uuid),
          })
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Delete property mutation
  const useDeleteProperty = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        await client.node.softDeleteProperty(uuid)
        return uuid
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.lists(),
        })
        queryClient.removeQueries({
          queryKey: queryKeys.properties.detail(deletedUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Soft-delete a single property value
  const useSoftDeletePropertyValue = () => {
    return useMutation({
      mutationFn: async (valueUuid: string) => {
        await client.node.softDeletePropertyValue(valueUuid)
        return valueUuid
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Add property to object using the restored convenience method
  const useAddPropertyToObject = () => {
    return useMutation({
      mutationFn: async ({
        objectUuid,
        property,
      }: {
        objectUuid: string
        property: Partial<UUPropertyDTO> & { key: string }
      }) => {
        const response = await client.node.addPropertyToObject(
          objectUuid,
          property
        )
        return { objectUuid, property: response }
      },
      onSuccess: ({ objectUuid }) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.objects.detail(objectUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.lists(),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.detail(objectUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Set value for property using the restored convenience method
  const useSetPropertyValue = () => {
    return useMutation({
      mutationFn: async ({
        propertyUuid,
        value,
      }: {
        propertyUuid: string
        value: Partial<UUPropertyValueDTO>
      }) => {
        const response = await client.node.setValueForProperty(
          propertyUuid,
          value
        )
        return { propertyUuid, value: response }
      },
      onSuccess: ({ propertyUuid }) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.detail(propertyUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  // Update property with values
  const useUpdatePropertyWithValues = () => {
    return useMutation({
      mutationFn: async ({
        propertyUuid,
        values,
      }: {
        propertyUuid: string
        values: Partial<UUPropertyValueDTO>[]
      }) => {
        const responses = await Promise.all(
          values.map((value) =>
            client.node.setValueForProperty(propertyUuid, value)
          )
        )
        return { propertyUuid, values: responses }
      },
      onSuccess: ({ propertyUuid }) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.properties.detail(propertyUuid),
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.aggregates.lists(),
        })
      },
    })
  }

  return {
    useAllProperties,
    useProperty,
    useCreateProperty,
    useUpdateProperty,
    useDeleteProperty,
    useSoftDeletePropertyValue,
    useAddPropertyToObject,
    useSetPropertyValue,
    useUpdatePropertyWithValues,
  }
}
