'use client'

import { useState, useCallback } from 'react'
import type { UUPropertyDTO, UUPropertyValueDTO } from 'iom-sdk'
import { Predicate } from 'iom-sdk'

import { logger } from '@/lib'
import { useProperties } from '@/hooks/api/use-properties'
import { useMathFormulas } from '@/hooks/api/use-math-formulas'
import { useStatements } from '@/hooks/api/use-statements'

/**
 * A hook that provides comprehensive property management functions
 */
export function usePropertyManagement() {
  const {
    useUpdatePropertyWithValues,
    useUpdateProperty,
    useAddPropertyToObject,
    useSetPropertyValue,
    useDeleteProperty,
  } = useProperties()

  const { useCreateFormulaCalc, useDeleteFormulaCalc } = useMathFormulas()
  const { useCreateStatement, useDeleteStatement } = useStatements()

  const updatePropertyMutation = useUpdatePropertyWithValues()
  const updatePropertyMetaMutation = useUpdateProperty()
  const addPropertyMutation = useAddPropertyToObject()
  const setValueMutation = useSetPropertyValue()
  const deletePropertyMutation = useDeleteProperty()
  const createFormulaCalcMutation = useCreateFormulaCalc()
  const deleteFormulaCalcMutation = useDeleteFormulaCalc()
  const createStatementMutation = useCreateStatement()
  const deleteStatementMutation = useDeleteStatement()

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
        const newProperty = response.property.data

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
   * This updates both the property metadata (key/name) AND the values
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
        // First, update the property metadata (key/name) if provided
        if (property.key !== undefined) {
          logger.info('Updating property key:', {
            uuid: property.uuid,
            key: property.key,
          })
          await updatePropertyMetaMutation.mutateAsync({
            uuid: property.uuid,
            key: property.key,
          })
        }

        // Then update the values
        const result = await updatePropertyMutation.mutateAsync({
          propertyUuid: property.uuid,
          values,
        })
        return result
      } catch (err) {
        logger.error('Failed to update property:', err)
        setError(
          err instanceof Error ? err : new Error('Failed to update property')
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [updatePropertyMutation, updatePropertyMetaMutation]
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

  /**
   * Create a formula calculation for a property value (text → formula conversion)
   */
  const createFormulaCalcForValue = useCallback(
    async (
      objectUuid: string,
      formulaData: any,
      args: Array<{ name: string; propertyValueUUID: string }>,
      resultPropertyValueUUID: string
    ) => {
      if (!formulaData?.formulaUuid || args.length === 0) return null

      try {
        // Create the formula calc
        const calcUuid = crypto.randomUUID()
        const calc = await createFormulaCalcMutation.mutateAsync({
          uuid: calcUuid,
          args,
          result: { propertyValueUUID: resultPropertyValueUUID },
        })

        // Create HAS_MATH_FORMULA_CALC statement
        await createStatementMutation.mutateAsync({
          subject: objectUuid,
          predicate: Predicate.HAS_MATH_FORMULA_CALC,
          object: calc.uuid,
        })

        return calc
      } catch (err) {
        logger.error('Error creating formula calc:', err)
        throw err
      }
    },
    [createFormulaCalcMutation, createStatementMutation]
  )

  /**
   * Delete a formula calculation (formula → text conversion)
   */
  const deleteFormulaCalcForValue = useCallback(
    async (objectUuid: string, calcUuid: string) => {
      try {
        // Delete the HAS_MATH_FORMULA_CALC statement
        await deleteStatementMutation.mutateAsync({
          subject: objectUuid,
          predicate: Predicate.HAS_MATH_FORMULA_CALC,
          object: calcUuid,
        })

        // Soft-delete the formula calc
        await deleteFormulaCalcMutation.mutateAsync(calcUuid)
      } catch (err) {
        logger.error('Error deleting formula calc:', err)
        throw err
      }
    },
    [deleteFormulaCalcMutation, deleteStatementMutation]
  )

  return {
    createPropertyForObject,
    updatePropertyWithValues,
    addValueToProperty,
    removePropertyFromObject,
    createFormulaCalcForValue,
    deleteFormulaCalcForValue,
    isLoading,
    error,
  }
}
