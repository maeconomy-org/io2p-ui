import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { usePropertyManagement } from '@/hooks'

export interface UsePropertyEditorProps {
  initialProperties?: any[]
  objectUuid?: string
  isEditing: boolean
}

export interface UsePropertyEditorReturn {
  editedProperties: any[]
  setEditedProperties: (properties: any[]) => void
  saveProperties: () => Promise<void>
  hasPropertiesChanged: boolean
}

/**
 * Hook for managing property editing operations
 */
export function usePropertyEditor({
  initialProperties = [],
  objectUuid,
  isEditing,
}: UsePropertyEditorProps): UsePropertyEditorReturn {
  const [editedProperties, setEditedProperties] = useState<any[]>([])

  // Use our property management hook
  const {
    updatePropertyWithValues,
    createPropertyForObject,
    removePropertyFromObject,
  } = usePropertyManagement(objectUuid)

  // Reset editing properties when data changes or editing mode changes
  useEffect(() => {
    if (initialProperties && !isEditing) {
      setEditedProperties([...initialProperties])
    }
  }, [initialProperties, isEditing])

  // Check if properties have changed
  const hasPropertiesChanged = editedProperties.some((prop) => {
    // Check if the property has been flagged as modified, deleted, or is new
    if (prop._isNew || prop._deleted || prop._modified) {
      return true
    }

    // Additional check: compare with original properties
    const originalProp = initialProperties.find(
      (p: any) => p.uuid === prop.uuid
    )
    if (!originalProp) return false

    // Check if key has changed
    if (prop.key !== originalProp.key) return true

    // Check if values have changed
    if (prop.values?.length !== originalProp.values?.length) return true

    // Check if any value content has changed
    const valuesChanged = prop.values?.some((val: any, i: number) => {
      const origVal = originalProp.values?.[i]
      return !origVal || val.value !== origVal.value
    })

    return valuesChanged
  })

  const saveProperties = async (): Promise<void> => {
    if (!editedProperties || !objectUuid) {
      throw new Error('Missing required data for property update')
    }

    // Create an array of properties that need to be updated
    const propertiesToUpdate = editedProperties.filter((prop) => {
      // Check if the property has been flagged as modified, deleted, or is new
      if (prop._isNew || prop._deleted || prop._modified) {
        return true
      }

      // Additional check: compare with original properties
      const originalProp = initialProperties.find(
        (p: any) => p.uuid === prop.uuid
      )
      if (!originalProp) return false

      // Check if key has changed
      if (prop.key !== originalProp.key) return true

      // Check if values have changed
      if (prop.values?.length !== originalProp.values?.length) return true

      // Check if any value content has changed
      const valuesChanged = prop.values?.some((val: any, i: number) => {
        const origVal = originalProp.values?.[i]
        return !origVal || val.value !== origVal.value
      })

      return valuesChanged
    })

    // If no changes, just return
    if (propertiesToUpdate.length === 0) {
      return
    }

    try {
      // Create an array to track all API operations
      const operations = []

      // Process each property that needs updating
      for (const property of propertiesToUpdate) {
        if (property._deleted) {
          // Delete property if marked for deletion
          operations.push(removePropertyFromObject(objectUuid, property.uuid))
        } else if (property._isNew) {
          // Create new property with only key and values
          // Filter out any empty values
          const nonEmptyValues = (property.values || []).filter(
            (val: any) =>
              // Skip empty values
              val.value !== undefined &&
              val.value !== '' &&
              // Skip values marked as needing input (from the collapsible-property component)
              val._needsInput !== true
          )

          operations.push(
            createPropertyForObject(objectUuid, {
              key: property.key,
              values: nonEmptyValues,
            })
          )
        } else {
          // Update existing property - don't rely on _modified flag exclusively
          // Filter out any empty values
          const nonEmptyValues = (property.values || []).filter(
            (val: any) =>
              // Skip empty values
              val.value !== undefined &&
              val.value !== '' &&
              // Skip values marked as needing input (from the collapsible-property component)
              val._needsInput !== true
          )

          operations.push(
            updatePropertyWithValues(
              {
                uuid: property.uuid,
                key: property.key, // This will update the key/name
              },
              nonEmptyValues // Only include non-empty values
            )
          )
        }
      }

      // Wait for all operations to complete
      await Promise.all(operations)

      toast.success('Object properties updated successfully')
    } catch (error) {
      logger.error('Error saving properties:', error)
      toast.error('Failed to update object properties')
      throw error
    }
  }

  return {
    editedProperties,
    setEditedProperties,
    saveProperties,
    hasPropertiesChanged,
  }
}
