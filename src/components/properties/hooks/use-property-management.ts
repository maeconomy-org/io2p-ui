'use client'

import { useState, useCallback } from 'react'
import { Predicate, type UUPropertyDTO, type UUPropertyValueDTO } from 'iom-sdk'

import { logger } from '@/lib'
import { useProperties } from '@/hooks/api/use-properties'
import { useMathFormulas } from '@/hooks/api/use-math-formulas'
import { useStatements } from '@/hooks/api/use-statements'
import { useUuid } from '@/hooks/api/use-uuid'

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
    useSoftDeletePropertyValue,
  } = useProperties()

  const { useCreateFormulaCalc, useDeleteFormulaCalc } = useMathFormulas()
  const { useCreateStatement } = useStatements()
  const { useGenerateUuid } = useUuid()

  const updatePropertyMutation = useUpdatePropertyWithValues()
  const updatePropertyMetaMutation = useUpdateProperty()
  const addPropertyMutation = useAddPropertyToObject()
  const setValueMutation = useSetPropertyValue()
  const deletePropertyMutation = useDeleteProperty()
  const deletePropertyValueMutation = useSoftDeletePropertyValue()
  const createFormulaCalcMutation = useCreateFormulaCalc()
  const deleteFormulaCalcMutation = useDeleteFormulaCalc()
  const createStatementMutation = useCreateStatement()
  const generateUuidMutation = useGenerateUuid()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Create a new property for an object.
   * Returns the created property with value UUIDs populated.
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
        const createdValues: Array<{ uuid: string; index: number }> = []
        if (newProperty && newProperty.uuid && values.length > 0) {
          for (let i = 0; i < values.length; i++) {
            const isFormula = !!values[i]?.formulaData?.formulaUuid
            const valueResponse = await setValueMutation.mutateAsync({
              propertyUuid: newProperty.uuid,
              // For formula values, omit `value` so backend computes it
              value: isFormula ? {} : { value: values[i].value },
            })
            // Track the created value UUID for formula calc creation
            const valueUuid = valueResponse?.value?.data?.uuid
            if (valueUuid) {
              createdValues.push({ uuid: valueUuid, index: i })
            }
          }
        }

        return { ...newProperty, _createdValues: createdValues }
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
        value?: string
        valueTypeCast?: string
      }> = []
    ) => {
      setIsLoading(true)
      setError(null)

      try {
        // First, update the property metadata (key/label) if provided
        if (property.key !== undefined) {
          logger.info('Updating property metadata:', {
            uuid: property.uuid,
            key: property.key,
            label: property.label,
          })
          await updatePropertyMetaMutation.mutateAsync({
            uuid: property.uuid,
            key: property.key,
            label: property.label,
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
   * Soft-delete a single property value by UUID.
   */
  const softDeleteValue = useCallback(
    async (valueUuid: string) => {
      setIsLoading(true)
      setError(null)

      try {
        await deletePropertyValueMutation.mutateAsync(valueUuid)
        return { success: true }
      } catch (err) {
        logger.error('Failed to soft-delete property value:', err)
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to soft-delete property value')
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [deletePropertyValueMutation]
  )

  /**
   * Remove a property from an object (soft delete the property).
   * Cascades soft-delete to the property's values first so they don't
   * get orphaned (backend does not cascade today).
   */
  const removePropertyFromObject = useCallback(
    async (
      _objectId: string,
      propertyUuid: string,
      valueUuids: string[] = []
    ) => {
      setIsLoading(true)
      setError(null)

      try {
        if (valueUuids.length > 0) {
          await Promise.all(
            valueUuids.map((uuid) =>
              deletePropertyValueMutation.mutateAsync(uuid)
            )
          )
        }
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
    [deletePropertyMutation, deletePropertyValueMutation]
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
        logger.info('Creating formula calc:', {
          formulaUuid: formulaData.formulaUuid,
          args,
          resultPropertyValueUUID,
        })

        // Step 1: Register a UUID via the registry API
        const registeredUuid = await generateUuidMutation.mutateAsync()
        logger.info('Registered UUID for formula calc:', { registeredUuid })

        // Step 2: Create the MathFormulaCalc record with the registered UUID
        const calc = await createFormulaCalcMutation.mutateAsync({
          uuid: registeredUuid,
          args,
          result: { propertyValueUUID: resultPropertyValueUUID },
        })

        const createdCalcUuid = calc?.uuid
        if (!createdCalcUuid) {
          throw new Error('Backend did not return a calc UUID')
        }

        logger.info('Formula calc created:', { createdCalcUuid })

        await createStatementMutation.mutateAsync({
          subject: formulaData.formulaUuid,
          predicate: Predicate.HAS_MATH_FORMULA_CALC,
          object: createdCalcUuid,
        })

        await createStatementMutation.mutateAsync({
          subject: objectUuid,
          predicate: Predicate.HAS_MATH_FORMULA_CALC,
          object: createdCalcUuid,
        })

        return calc
      } catch (err) {
        logger.error('Error creating formula calc:', err)
        throw err
      }
    },
    [createFormulaCalcMutation, createStatementMutation, generateUuidMutation]
  )

  /**
   * Delete a formula calculation (formula → text conversion)
   */
  const deleteFormulaCalcForValue = useCallback(
    async (_objectUuid: string, calcUuid: string, _formulaUuid?: string) => {
      try {
        // Soft-delete the formula calc via DELETE /api/UUMathFormulaCalc/{uuid}
        // Statements are intentionally not deleted — backend owns that wiring.
        await deleteFormulaCalcMutation.mutateAsync(calcUuid)
      } catch (err) {
        logger.error('Error deleting formula calc:', err)
        throw err
      }
    },
    [deleteFormulaCalcMutation]
  )

  return {
    createPropertyForObject,
    updatePropertyWithValues,
    addValueToProperty,
    removePropertyFromObject,
    softDeleteValue,
    createFormulaCalcForValue,
    deleteFormulaCalcForValue,
    isLoading,
    error,
  }
}
