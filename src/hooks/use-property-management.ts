'use client'

import { useState, useCallback } from 'react'
import type { UUPropertyDTO, UUPropertyValueDTO } from 'iom-sdk'

import { logger } from '@/lib'
import { useProperties } from './api'

/**
 * A hook that provides comprehensive property management functions
 */
export function usePropertyManagement(objectUuid?: string) {
  const {
    useUpdatePropertyWithValues,
    useAddPropertyToObject,
    useSetPropertyValue,
    useDeleteProperty,
  } = useProperties()

  const updatePropertyMutation = useUpdatePropertyWithValues()
  const addPropertyMutation = useAddPropertyToObject()
  const setValueMutation = useSetPropertyValue()
  const deletePropertyMutation = useDeleteProperty()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Create a new property for an object
   */
  const createPropertyForObject = useCallback(
    async (objectId: string, propertyData: any) => {
      setIsLoading(true)
      setError(null)

      try {
        // Extract values from property data if present
        const values = propertyData.values || []
        const propertyMetadata = { ...propertyData }
        delete propertyMetadata.values

        // Create the property first
        const response = await addPropertyMutation.mutateAsync({
          objectUuid: objectId,
          property: propertyMetadata,
        })

        // Get the property UUID from the response
        // Based on API response structure in useAddPropertyToObject
        const newProperty = response.property

        // If we have a property UUID and values, add them
        if (newProperty && newProperty.uuid && values.length > 0) {
          for (const value of values) {
            await setValueMutation.mutateAsync({
              propertyUuid: newProperty.uuid,
              value: {
                value: value.value,
              },
            })
          }
        }

        return newProperty
      } catch (err) {
        logger.error('Error creating property:', err)
        setError(err as Error)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [addPropertyMutation, setValueMutation]
  )

  /**
   * Update a property and its values in a single operation
   */
  const updatePropertyWithValues = useCallback(
    async (
      property: UUPropertyDTO,
      values: Array<{
        uuid?: string
        value: string
        valueTypeCast?: string
      }> = []
    ) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await updatePropertyMutation.mutateAsync({
          property,
          values,
        })
        return result
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to update property')
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [updatePropertyMutation]
  )

  /**
   * Add a value to an existing property
   */
  const addValueToProperty = useCallback(
    async (propertyUuid: string, valueData: Partial<UUPropertyValueDTO>) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await setValueMutation.mutateAsync({
          propertyUuid,
          value: valueData,
        })
        return result
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to add value to property')
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [setValueMutation]
  )

  /**
   * Remove a property from an object (soft delete the property)
   */
  const removePropertyFromObject = useCallback(
    async (objectId: string, propertyUuid: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // Use the property's soft delete API instead of deleting statements
        // This will properly soft-delete the property
        await deletePropertyMutation.mutateAsync(propertyUuid)

        return { success: true }
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to remove property from object')
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [deletePropertyMutation]
  )

  return {
    createPropertyForObject,
    updatePropertyWithValues,
    addValueToProperty,
    removePropertyFromObject,
    isLoading,
    error,
  }
}
