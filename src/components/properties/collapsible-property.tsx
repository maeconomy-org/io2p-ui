import { useRef, useState } from 'react'
import { ChevronRight, FunctionSquare, Plus, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { formatNumericValue } from '@/lib'
import { Badge, Button, Input, Label } from '@/components/ui'
import { FileList } from '@/components/object-sheets/components/file-display'
import { FormulaDisplay } from './formula-display'
import { FormulaEditor } from './formula-editor'
import { ValueModeToggle } from './value-mode-toggle'
import type { AvailableProperty } from './hooks/use-formula-evaluation'

const EMPTY_AVAILABLE_PROPERTIES: AvailableProperty[] = []

interface CollapsiblePropertyProps {
  property: any
  isExpanded: boolean
  onToggle: () => void
  isEditable: boolean
  onUpdate?: (updatedProperty: any) => void
  onRemove?: () => void
  availableProperties?: AvailableProperty[]
}

/**
 * Inline value item with its own Text/Formula toggle.
 * Used inside CollapsibleProperty for each value.
 */
function CollapsibleValueItem({
  value,
  valueIndex,
  isEditable,
  availableProperties,
  onValueChange,
  onFormulaChange,
  onRemove,
}: {
  value: any
  valueIndex: number
  isEditable: boolean
  availableProperties: AvailableProperty[]
  onValueChange: (index: number, newValue: string) => void
  onFormulaChange: (index: number, formulaData: any) => void
  onRemove: (index: number) => void
}) {
  const t = useTranslations()
  const [isFormulaMode, setIsFormulaMode] = useState(
    !!value.formulaData?.formula
  )

  const hasFormula = !!value.formulaData?.formula

  return (
    <div className="space-y-2 border rounded-md p-2 bg-muted/5">
      {/* Value header with toggle + actions */}
      {isEditable && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            {t('objects.propertyValue')}
          </Label>
          <div className="flex items-center gap-1">
            <ValueModeToggle
              isFormulaMode={isFormulaMode}
              onTextMode={() => {
                if (isFormulaMode) {
                  setIsFormulaMode(false)
                  onValueChange(
                    valueIndex,
                    value.formulaData?.result?.toString() || value.value || ''
                  )
                  onFormulaChange(valueIndex, undefined)
                }
              }}
              onFormulaMode={() => {
                if (!isFormulaMode) {
                  setIsFormulaMode(true)
                  if (!value.formulaData) {
                    onFormulaChange(valueIndex, {
                      formula: '',
                      variableMapping: {},
                      result: null,
                      isValid: false,
                    })
                  }
                }
              }}
            />

            {/* Delete button (always visible in edit mode) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(valueIndex)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Value content (full width) */}
      {isFormulaMode && isEditable ? (
        <FormulaEditor
          availableProperties={availableProperties}
          initialFormula={value.formulaData?.formula || ''}
          initialMapping={value.formulaData?.variableMapping}
          onChange={(data) => {
            onFormulaChange(valueIndex, {
              formula: data.formula,
              variableMapping: data.variableMapping,
              result: data.result,
              resolvedExpression: data.resolvedExpression,
              isValid: data.isValid,
            })
            // Also update the value field with the result
            if (data.result !== null && data.result !== undefined) {
              onValueChange(valueIndex, data.result.toString())
            }
          }}
        />
      ) : isFormulaMode && !isEditable && hasFormula ? (
        <FormulaDisplay
          formula={value.formulaData.formula}
          resolvedExpression={value.formulaData.resolvedExpression}
          result={value.formulaData.result}
          variableMapping={value.formulaData.variableMapping}
        />
      ) : isEditable ? (
        <Input
          value={value.value || ''}
          onChange={(e) => onValueChange(valueIndex, e.target.value)}
          placeholder={t('objects.propertyValuePlaceholder')}
        />
      ) : (
        <div className="p-2 border rounded-md bg-background w-full">
          {formatNumericValue(value.value)}
        </div>
      )}

      {/* Value-level Files */}
      {value.files && value.files.length > 0 && (
        <div className="mt-1">
          <FileList files={value.files} />
        </div>
      )}
    </div>
  )
}

export function CollapsibleProperty({
  property,
  isExpanded,
  onToggle,
  isEditable,
  onUpdate,
  onRemove,
  availableProperties = EMPTY_AVAILABLE_PROPERTIES,
}: CollapsiblePropertyProps) {
  const t = useTranslations()
  const [editedProperty, setEditedProperty] = useState<any>({})
  const prevPropertyRef = useRef<any>(undefined)

  if (property !== prevPropertyRef.current) {
    prevPropertyRef.current = property
    setEditedProperty(property)
  }

  // Check if any value has a formula
  const hasAnyFormula = (editedProperty.values || []).some(
    (v: any) => !!v.formulaData?.formula
  )

  // Handle field changes when editing
  const handleChange = (field: string, value: any) => {
    if (!isEditable || !onUpdate) return

    const updated = {
      ...editedProperty,
      [field]: value,
      _modified: true,
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Handle value text changes
  const handleValueChange = (valueIndex: number, newValue: string) => {
    if (!isEditable || !onUpdate) return

    const updatedValues = [...(editedProperty.values || [])]
    updatedValues[valueIndex] = {
      ...updatedValues[valueIndex],
      value: newValue,
      ...(newValue !== '' ? { _needsInput: false } : {}),
    }

    const updated = {
      ...editedProperty,
      values: updatedValues,
      _modified: true,
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Handle value formula changes
  const handleValueFormulaChange = (valueIndex: number, formulaData: any) => {
    if (!isEditable || !onUpdate) return

    const updatedValues = [...(editedProperty.values || [])]
    updatedValues[valueIndex] = {
      ...updatedValues[valueIndex],
      formulaData,
    }

    const updated = {
      ...editedProperty,
      values: updatedValues,
      _modified: true,
    }

    setEditedProperty(updated)
    onUpdate(updated)
  }

  // Add a new value
  const handleAddValue = () => {
    if (!isEditable || !onUpdate) return

    const currentValues = editedProperty.values || []
    const updatedValues = [...currentValues, { value: '', _needsInput: true }]

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
          <div className="font-medium flex items-center gap-1.5">
            {property.key}
            {hasAnyFormula && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] gap-0.5 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
              >
                <FunctionSquare className="h-2.5 w-2.5" />
                fx
              </Badge>
            )}
          </div>

          <div className="ml-4 text-sm text-muted-foreground">
            {property.values?.length === 1
              ? property.values[0].formulaData?.formula
                ? `= ${formatNumericValue(property.values[0].formulaData.result) ?? '...'}`
                : formatNumericValue(property.values[0].value)
              : t('objects.values', {
                  count: property.values?.length || 0,
                })}
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
          {/* Property Metadata - Key field */}
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

          {/* Values Section */}
          <div>
            <h4 className="font-medium mb-2">{t('objects.propertyValues')}</h4>

            <div className="space-y-3">
              {(editedProperty.values || []).map(
                (value: any, index: number) => (
                  <CollapsibleValueItem
                    key={value.uuid || `new-${index}`}
                    value={value}
                    valueIndex={index}
                    isEditable={isEditable}
                    availableProperties={availableProperties}
                    onValueChange={handleValueChange}
                    onFormulaChange={handleValueFormulaChange}
                    onRemove={handleRemoveValue}
                  />
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
