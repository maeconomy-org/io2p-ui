import { useState } from 'react'
import { ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, Input, Label } from '@/components/ui'
import { FileList } from '@/components/object-sheets/components/file-display'

interface CollapsiblePropertyProps {
  property: any
  isExpanded: boolean
  onToggle: () => void
  isEditable: boolean
  onUpdate?: (updatedProperty: any) => void
  onRemove?: () => void
}

export function CollapsibleProperty({
  property,
  isExpanded,
  onToggle,
  isEditable,
  onUpdate,
  onRemove,
}: CollapsiblePropertyProps) {
  const t = useTranslations()
  const [editedProperty, setEditedProperty] = useState(property)

  // Handle field changes when editing
  const handleChange = (field: string, value: any) => {
    if (!isEditable || !onUpdate) return

    const updated = {
      ...editedProperty,
      [field]: value,
      _modified: true, // Explicitly mark as modified when any field changes
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Handle value changes
  const handleValueChange = (valueIndex: number, newValue: string) => {
    if (!isEditable || !onUpdate) return

    const updatedValues = [...(editedProperty.values || [])]

    // Update the value
    updatedValues[valueIndex] = {
      ...updatedValues[valueIndex],
      value: newValue,
      // If the user actually entered a value, remove the _needsInput flag
      ...(newValue !== '' ? { _needsInput: false } : {}),
    }

    // Create updated property with modified flag
    const updated = {
      ...editedProperty,
      values: updatedValues,
      _modified: true, // Always mark as modified when values change
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Add a new value
  const handleAddValue = () => {
    if (!isEditable || !onUpdate) return

    // Create an empty array if values doesn't exist
    const currentValues = editedProperty.values || []

    // Create a new value with empty string, but mark it as _needsInput
    // This will be used to indicate it's an empty placeholder that shouldn't be saved
    const updatedValues = [...currentValues, { value: '', _needsInput: true }]

    // Update the property with new values
    const updated = {
      ...editedProperty,
      values: updatedValues,
      _modified: true,
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Remove a value
  const handleRemoveValue = (valueIndex: number) => {
    if (!isEditable || !onUpdate) return

    const updatedValues = [...(editedProperty.values || [])]
    updatedValues.splice(valueIndex, 1)
    handleChange('values', updatedValues)
  }

  return (
    <div
      className={`border rounded-md overflow-hidden ${isExpanded ? 'shadow-md' : ''}`}
    >
      {/* Summary Row (Always Visible) */}
      <div className="flex justify-between items-center">
        <div
          className="px-4 py-3 flex-1 flex items-center cursor-pointer hover:bg-muted/50"
          onClick={onToggle}
        >
          <ChevronRight
            className={`h-4 w-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <div className="font-medium">{property.key}</div>

          <div className="ml-4 text-sm text-muted-foreground">
            {property.values?.length === 1
              ? property.values[0].value
              : t('objects.values', { count: property.values?.length || 0 })}
          </div>
        </div>

        {isEditable && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="mr-2">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t bg-muted/10">
          {/* Property Metadata - Only Key field */}
          <div className="mb-4">
            {isEditable ? (
              <div className="space-y-2">
                <Label htmlFor={`property-key-${property.uuid || 'new'}`}>
                  {t('objects.propertyName')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`property-key-${property.uuid || 'new'}`}
                    value={editedProperty.key}
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder={t('objects.propertyNamePlaceholder')}
                    className="flex-1"
                  />
                </div>
                {property.files && property.files.length > 0 && (
                  <div className="mt-2">
                    <FileList files={property.files} />
                  </div>
                )}
              </div>
            ) : (
              property.uuid && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">UUID:</span>
                  <span className="font-mono text-xs">{property.uuid}</span>
                </div>
              )
            )}
          </div>

          {/* Property Values Section */}
          <div>
            <h4 className="font-medium mb-2">{t('objects.propertyValues')}</h4>

            <div className="space-y-4">
              {(editedProperty.values || []).map(
                (value: any, index: number) => (
                  <div key={value.uuid || `new-${index}`} className="space-y-2">
                    {isEditable ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={value.value || ''}
                          onChange={(e) =>
                            handleValueChange(index, e.target.value)
                          }
                          placeholder={t('objects.propertyValuePlaceholder')}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveValue(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="p-2 border rounded-md bg-background w-full">
                        {value.value}
                      </div>
                    )}

                    {/* Value-level Files */}
                    {value.files && value.files.length > 0 && (
                      <div className="mt-2">
                        <FileList files={value.files} />
                      </div>
                    )}
                  </div>
                )
              )}

              {(!editedProperty.values ||
                editedProperty.values.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  {t('objects.noValues')}
                </div>
              )}

              {isEditable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddValue}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
