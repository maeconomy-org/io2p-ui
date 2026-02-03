import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UUPropertyDTO, UUPropertyValueDTO, QueryParams } from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'

export function useProperties() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all properties using the unified API
  const useAllProperties = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['properties', queryParams],
      queryFn: async () => {
        const response = await client.node.getProperties({
          softDeleted: false,
          ...queryParams,
        })
        return response
      },
      enabled,
    })
  }

  // Get property by UUID
  const useProperty = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['property', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.node.getProperties({ uuid })
        return response?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
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
        queryClient.invalidateQueries({ queryKey: ['properties'] })
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
        queryClient.invalidateQueries({ queryKey: ['properties'] })
        queryClient.invalidateQueries({ queryKey: ['property', property.uuid] })
        queryClient.invalidateQueries({ queryKey: ['object'] })
      },
    })
  }

  // Delete property mutation
  const useDeleteProperty = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.node.softDeleteProperty(uuid)
        return response
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({ queryKey: ['properties'] })
        queryClient.removeQueries({ queryKey: ['property', deletedUuid] })
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
      onSuccess: ({ objectUuid, property }) => {
        if (!property) return

        queryClient.invalidateQueries({
          queryKey: ['object', objectUuid, 'withProperties'],
        })
        queryClient.invalidateQueries({ queryKey: ['properties'] })
        queryClient.invalidateQueries({ queryKey: ['object', objectUuid] })
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
      onSuccess: ({ propertyUuid, value }) => {
        if (!value) return

        queryClient.invalidateQueries({ queryKey: ['property', propertyUuid] })
        queryClient.invalidateQueries({ queryKey: ['object'] })
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
        queryClient.invalidateQueries({ queryKey: ['property', propertyUuid] })
        queryClient.invalidateQueries({ queryKey: ['object'] })
      },
    })
  }

  return {
    useAllProperties,
    useProperty,
    useCreateProperty,
    useUpdateProperty,
    useDeleteProperty,
    useAddPropertyToObject,
    useSetPropertyValue,
    useUpdatePropertyWithValues,
  }
}
