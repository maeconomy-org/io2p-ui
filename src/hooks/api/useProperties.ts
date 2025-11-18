import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIomSdkClient } from '@/contexts'
import type { UUPropertyDTO, UUPropertyValueDTO, QueryParams } from 'iom-sdk'

export function useProperties() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  // Get all properties using the new unified API
  const useAllProperties = (options?: QueryParams & { enabled?: boolean }) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['properties', queryParams],
      queryFn: async () => {
        const response = await client.properties.getProperties({
          softDeleted: false,
          ...queryParams,
        })
        return response.data
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
        const response = await client.properties.getProperties({ uuid })
        // Since API returns array, get the first property
        return response.data?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
    })
  }

  // Get property by key
  const usePropertyByKey = (
    key: string,
    options?: QueryParams & { enabled?: boolean }
  ) => {
    const { enabled = true, ...queryParams } = options || {}
    return useQuery({
      queryKey: ['property', 'key', key, queryParams],
      queryFn: async () => {
        if (!key) return null
        const response = await client.properties.getPropertyByKey(
          key,
          queryParams
        )
        return response.data
      },
      enabled: !!key && enabled,
    })
  }

  // Create property mutation - using new simplified method
  const useCreateProperty = () => {
    return useMutation({
      mutationFn: async (property: UUPropertyDTO) => {
        const response = await client.properties.create(property)
        return response.data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['properties'] })
      },
    })
  }

  // Delete property mutation - using new simplified method
  const useDeleteProperty = () => {
    return useMutation({
      mutationFn: async (uuid: string) => {
        const response = await client.properties.delete(uuid)
        return response.data
      },
      onSuccess: (deletedUuid) => {
        queryClient.invalidateQueries({ queryKey: ['properties'] })
        queryClient.removeQueries({ queryKey: ['property', deletedUuid] })
      },
    })
  }

  // Add property to object
  const useAddPropertyToObject = () => {
    return useMutation({
      mutationFn: async ({
        objectUuid,
        property,
      }: {
        objectUuid: string
        property: Partial<UUPropertyDTO> & { key: string }
      }) => {
        const response = await client.properties.addToObject(
          objectUuid,
          property
        )
        return { objectUuid, property: response.data }
      },
      onSuccess: ({ objectUuid, property }) => {
        if (!property) return

        // Update the object with properties cache directly
        queryClient.setQueryData(
          ['object', objectUuid, 'withProperties'],
          (oldData: any) => {
            if (!oldData) return oldData

            // Add the new property to the object's properties
            const updatedData = { ...oldData }
            if (!updatedData.properties) {
              updatedData.properties = []
            }

            // Add in the format expected by the object details sheet
            updatedData.properties.push({
              property: [property],
              values: [],
            })

            return updatedData
          }
        )

        // Also invalidate the queries that might need a refresh
        queryClient.invalidateQueries({
          queryKey: ['object', objectUuid, 'withProperties'],
        })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({
          queryKey: ['aggregate', objectUuid],
        })
        queryClient.invalidateQueries({ queryKey: ['properties'] })
      },
    })
  }

  // Get property value by UUID
  const usePropertyValue = (uuid: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['propertyValue', uuid],
      queryFn: async () => {
        if (!uuid) return null
        const response = await client.values.getPropertyValues({ uuid })
        // Since API returns array, get the first value
        return response.data?.[0] || null
      },
      enabled: !!uuid && options?.enabled !== false,
    })
  }

  // Set property value
  const useSetPropertyValue = () => {
    return useMutation({
      mutationFn: async ({
        propertyUuid,
        value,
      }: {
        propertyUuid: string
        value: Partial<UUPropertyValueDTO>
      }) => {
        const response = await client.values.setForProperty(propertyUuid, value)
        return { propertyUuid, value: response.data }
      },
      onSuccess: ({ propertyUuid, value }) => {
        if (!value) return

        // Try to update object cache directly for the specific property
        queryClient
          .getQueryCache()
          .findAll({ queryKey: ['object'] })
          .forEach((query) => {
            queryClient.setQueryData(query.queryKey, (oldData: any) => {
              if (!oldData || !oldData.properties) return oldData

              // Find the property group containing this property
              const updatedData = { ...oldData }
              const propertyGroup = updatedData.properties.find(
                (group: any) =>
                  group.property &&
                  group.property.some((p: any) => p.uuid === propertyUuid)
              )

              if (propertyGroup) {
                // Add the new value to the values array
                if (!propertyGroup.values) {
                  propertyGroup.values = []
                }

                // Add the value in the format expected by the object details
                propertyGroup.values.push({
                  value: [value],
                })
              }

              return updatedData
            })
          })

        // Invalidate the property and related queries
        queryClient.invalidateQueries({ queryKey: ['property', propertyUuid] })
        queryClient.invalidateQueries({ queryKey: ['object'] })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
        queryClient.invalidateQueries({ queryKey: ['propertyValue'] })
      },
    })
  }

  // Update property with values (combined operation)
  const useUpdatePropertyWithValues = () => {
    return useMutation({
      mutationFn: async ({
        property,
        values = [],
      }: {
        property: UUPropertyDTO
        values?: Array<{ uuid?: string; value: string; valueTypeCast?: string }>
      }) => {
        // First update the property metadata (like key)
        if (property.uuid) {
          // Use the create method which handles both create and update
          await client.properties.create({
            uuid: property.uuid,
            key: property.key,
          })
        }

        // Then process each value
        for (const value of values) {
          if (value.uuid) {
            // Update existing value using create method
            await client.values.create({
              uuid: value.uuid,
              value: value.value,
              valueTypeCast: value.valueTypeCast || 'string',
            })
          } else {
            // Add new value to the property using setForProperty method
            await client.values.setForProperty(property.uuid, {
              value: value.value,
              valueTypeCast: value.valueTypeCast || 'string',
            })
          }
        }

        // Return the updated property
        const response = await client.properties.getProperties({
          uuid: property.uuid,
        })
        return response.data?.[0] || null
      },
      onSuccess: (updatedProperty) => {
        if (!updatedProperty) return

        // Try to update object caches directly with the updated property
        queryClient
          .getQueryCache()
          .findAll({ queryKey: ['object'] })
          .forEach((query) => {
            queryClient.setQueryData(query.queryKey, (oldData: any) => {
              if (!oldData || !oldData.properties) return oldData

              const updatedData = { ...oldData }

              // Find the property group containing this property
              const propertyGroupIndex = updatedData.properties.findIndex(
                (group: any) =>
                  group.property &&
                  group.property.some(
                    (p: any) => p.uuid === updatedProperty.uuid
                  )
              )

              if (propertyGroupIndex >= 0) {
                // Update the property in the cache
                const propertyGroup = updatedData.properties[propertyGroupIndex]
                const propertyIndex = propertyGroup.property.findIndex(
                  (p: any) => p.uuid === updatedProperty.uuid
                )

                if (propertyIndex >= 0) {
                  // Update the property metadata
                  propertyGroup.property[propertyIndex] = {
                    ...propertyGroup.property[propertyIndex],
                    key: updatedProperty.key,
                    // Add other fields as needed
                  }
                }
              }

              return updatedData
            })
          })

        // Invalidate the caches to ensure eventual consistency
        queryClient.invalidateQueries({
          queryKey: ['property', updatedProperty.uuid],
        })
        queryClient.invalidateQueries({ queryKey: ['propertyValue'] })
        queryClient.invalidateQueries({ queryKey: ['object'] })

        // Also invalidate aggregate queries to refresh table/explorer views
        queryClient.invalidateQueries({ queryKey: ['aggregates'] })
      },
    })
  }

  return {
    useAllProperties,
    useProperty,
    usePropertyByKey,
    useCreateProperty,
    useDeleteProperty,
    useAddPropertyToObject,
    usePropertyValue,
    useSetPropertyValue,
    useUpdatePropertyWithValues,
  }
}
