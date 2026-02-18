import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui'
import { CollapsibleProperty } from './collapsible-property'
import type { AvailableProperty } from './hooks/use-formula-evaluation'

interface PropertySectionEditorProps {
  properties: any[]
  isEditable: boolean
  onUpdate?: (updatedProperties: any[]) => void
}

export function PropertySectionEditor({
  properties,
  isEditable,
  onUpdate,
}: PropertySectionEditorProps) {
  const t = useTranslations()
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(
    null
  )
  const [editedProperties, setEditedProperties] = useState<any[]>([])
  const [allProperties, setAllProperties] = useState<any[]>([]) // Including deleted properties

  // Handle expanding/collapsing properties
  const togglePropertyExpansion = (propertyId: string) => {
    setExpandedPropertyId(expandedPropertyId === propertyId ? null : propertyId)
  }

  // Update a property in the list
  const handlePropertyUpdate = (index: number, updatedProperty: any) => {
    if (!isEditable || !onUpdate) return

    const updated = [...editedProperties]

    // Compare with original property to check if it was modified
    const originalProperty =
      properties.find(
        (p) =>
          p.uuid === updatedProperty.uuid ||
          (p._tempId && p._tempId === updatedProperty._tempId)
      ) || properties[index]

    // Check if the property is new - if so, don't compare with original
    if (!updatedProperty._isNew) {
      // Determine if the property has been modified by comparing fields
      const isModified =
        // Check only key and values
        updatedProperty.key !== originalProperty.key ||
        // Check values - first check if lengths differ
        updatedProperty.values?.length !== originalProperty.values?.length ||
        // Then check each value
        (updatedProperty.values &&
          originalProperty.values &&
          updatedProperty.values.some((newVal: any, i: number) => {
            const origVal = originalProperty.values[i]
            // If there's no original value, or values differ
            return !origVal || newVal.value !== origVal.value
          }))

      // Mark as modified if changes detected
      if (isModified) {
        updatedProperty._modified = true
      }
    }

    // Update the property in the array
    updated[index] = updatedProperty

    // Update edited properties state
    setEditedProperties(updated)

    // Update all properties, including deleted ones
    const allUpdated = [...allProperties]
    const existingIndex = allUpdated.findIndex(
      (p) =>
        p.uuid === updatedProperty.uuid ||
        (p._tempId && p._tempId === updatedProperty._tempId)
    )

    if (existingIndex >= 0) {
      allUpdated[existingIndex] = updatedProperty
    } else {
      // If not found (shouldn't happen normally), add it
      allUpdated.push(updatedProperty)
    }

    setAllProperties(allUpdated)

    // Report changes to parent
    onUpdate(allUpdated)
  }

  const prevPropertiesRef = useRef<any[]>(undefined)

  if (properties !== prevPropertiesRef.current) {
    prevPropertiesRef.current = properties

    const visibleProps = properties.map((prop) => ({
      ...prop,
      _modified: false,
      _isNew: prop._isNew || false,
      _deleted: false,
    }))

    setEditedProperties(visibleProps)

    const allProps = [...visibleProps]
    allProperties
      .filter((p) => p._deleted)
      .forEach((deletedProp) => {
        if (!allProps.some((p) => p.uuid === deletedProp.uuid)) {
          allProps.push(deletedProp)
        }
      })

    setAllProperties(allProps)
  }

  // Add a new property
  const handleAddProperty = () => {
    if (!isEditable || !onUpdate) return

    // Generate a temporary ID for tracking until a UUID is assigned
    const tempId = `temp_${Date.now()}`

    // Create a simpler property object with only key and values
    // Auto-add first empty value so user can immediately fill it in
    const newProperty = {
      key: '',
      values: [{ value: '', _needsInput: true }],
      _isNew: true,
      _tempId: tempId, // Use temporary ID for tracking
    }

    // Add to visible properties
    const updatedVisible = [...editedProperties, newProperty]
    setEditedProperties(updatedVisible)

    // Add to all properties
    const updatedAll = [...allProperties, newProperty]
    setAllProperties(updatedAll)

    // Notify parent
    onUpdate(updatedAll)

    // Expand the new property immediately
    setExpandedPropertyId(tempId)
  }

  // Remove a property
  const handleRemoveProperty = (index: number) => {
    if (!isEditable || !onUpdate) return

    const propertyToRemove = editedProperties[index]

    // Update all properties including deleted ones
    const updatedAll = [...allProperties]
    const allIndex = updatedAll.findIndex(
      (p) =>
        p.uuid === propertyToRemove.uuid ||
        (p._tempId && p._tempId === propertyToRemove._tempId)
    )

    if (allIndex >= 0) {
      if (propertyToRemove._isNew) {
        // Remove new properties entirely
        updatedAll.splice(allIndex, 1)
      } else {
        // Mark existing properties for deletion
        updatedAll[allIndex] = {
          ...updatedAll[allIndex],
          _deleted: true,
        }
      }
    }

    // Update visible properties by filtering out the removed one
    const updatedVisible = editedProperties.filter((_, i) => i !== index)
    setEditedProperties(updatedVisible)
    setAllProperties(updatedAll)
    onUpdate(updatedAll)

    // Show toast notification with Sonner
    toast.success(
      propertyToRemove._isNew
        ? t('objects.propertyRemoved')
        : t('objects.propertyMarkedForDeletion')
    )
  }

  // Build available properties list for formula variable mapping.
  // Each property value becomes a separate selectable option.
  // Use deep dependency to trigger updates when property keys or values change
  const propertiesKey = JSON.stringify(
    editedProperties.map((p) => ({
      id: p.uuid || p._tempId,
      key: p.key,
      values: p.values?.map((v: any) => ({
        uuid: v.uuid,
        value: v.value,
      })),
      deleted: p._deleted,
    }))
  )
  const availableProperties = useMemo((): AvailableProperty[] => {
    const result: AvailableProperty[] = []

    editedProperties
      .filter((p) => !p._deleted && p.key)
      .forEach((p) => {
        const propId = p.uuid || p._tempId || ''
        const propKey = p.key
        const propLabel = p.label || p.key

        // Create one entry per value so each is independently selectable
        // Only include values that are non-empty and numeric (usable in formulas)
        if (p.values && p.values.length > 0) {
          p.values.forEach((v: any, idx: number) => {
            // Skip empty, placeholder, or non-numeric values
            if (!v.value || v._needsInput) return
            const trimmed = v.value.trim()
            if (trimmed === '' || isNaN(Number(trimmed))) return

            result.push({
              // Composite ID: propertyId::valueIndex for unique Select keys
              uuid: `${propId}::${idx}`,
              key: propKey,
              label: propLabel,
              value: trimmed,
              valueIndex: idx,
            })
          })
        }
      })

    return result
  }, [propertiesKey, editedProperties])

  return (
    <div className="space-y-4">
      {editedProperties.map((property, index) => {
        // Exclude current property's values from available properties for its own formula
        const propId = property.uuid || property._tempId || ''
        const siblingProperties = availableProperties.filter(
          (p) => !p.uuid.startsWith(`${propId}::`)
        )

        return (
          <CollapsibleProperty
            key={property.uuid || property._tempId || `new_${index}`}
            property={property}
            isExpanded={
              expandedPropertyId ===
              (property.uuid || property._tempId || `new_${index}`)
            }
            onToggle={() =>
              togglePropertyExpansion(
                property.uuid || property._tempId || `new_${index}`
              )
            }
            isEditable={isEditable}
            onUpdate={(updated) => handlePropertyUpdate(index, updated)}
            onRemove={() => handleRemoveProperty(index)}
            availableProperties={siblingProperties}
          />
        )
      })}

      {editedProperties.length === 0 ? (
        <div className="text-center p-4 border rounded-md bg-muted/10">
          <p className="text-muted-foreground">
            {t('objects.properties.noProperties')}
          </p>
          {isEditable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddProperty}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('objects.properties.addFirst')}
            </Button>
          )}
        </div>
      ) : (
        isEditable && (
          <Button
            variant="outline"
            onClick={handleAddProperty}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('objects.properties.add')}
          </Button>
        )
      )}
    </div>
  )
}
