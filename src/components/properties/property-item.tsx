'use client'

import { useState } from 'react'
import {
  ChevronRight,
  FunctionSquare,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UUMathFormulaDTO } from 'iom-sdk'

import { cn, formatNumericValue } from '@/lib'
import { Badge, Button, Input, Label } from '@/components/ui'
import { FileList } from '@/components/object-sheets/components/file-display'
import { FormulaDisplay } from './formula-display'
import { FormulaEditor } from './formula-editor'
import { FormulaPicker } from './formula-picker'
import { ValueModeToggle } from './value-mode-toggle'
import type { Property, PropertyValue, FormulaData } from './types'
import type { AvailableProperty } from './hooks/use-formula-evaluation'

const EMPTY_AVAILABLE_PROPERTIES: AvailableProperty[] = []

// ---------------------------------------------------------------------------
// PropertyValueItem — renders a single value in display or edit mode
// ---------------------------------------------------------------------------

interface PropertyValueItemProps {
  value: PropertyValue
  valueIndex: number
  propertyId: string
  isEditable: boolean
  availableProperties: AvailableProperty[]
  onValueChange?: (index: number, newValue: string) => void
  onFormulaChange?: (
    index: number,
    formulaData: FormulaData | undefined
  ) => void
  onRemove?: (index: number) => void
  onAttachFile?: () => void
  /** Hide the remove button (e.g. when this is the only value) */
  hideRemove?: boolean
}

function PropertyValueItem({
  value,
  valueIndex,
  propertyId,
  isEditable,
  availableProperties,
  onValueChange,
  onFormulaChange,
  onRemove,
  onAttachFile,
  hideRemove = false,
}: PropertyValueItemProps) {
  const t = useTranslations()
  const [isFormulaMode, setIsFormulaMode] = useState(
    !!value.formulaData?.formula
  )

  const hasFormula = !!value.formulaData?.formula

  return (
    <div className="border rounded-md p-2 bg-muted/5 space-y-2">
      {/* Value header with toggle + actions */}
      {isEditable && (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            {t('objects.propertyValue')}
          </Label>
          <div className="flex items-center gap-1">
            {onFormulaChange && (
              <ValueModeToggle
                isFormulaMode={isFormulaMode}
                onTextMode={() => {
                  if (isFormulaMode) {
                    setIsFormulaMode(false)
                    onValueChange?.(
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
            )}

            {onAttachFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAttachFile}
                className="h-7 w-7 p-0 text-muted-foreground"
                data-testid={`value-attach-file-${propertyId}-${valueIndex}`}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
            )}

            {!hideRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove?.(valueIndex)}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Value content */}
      {isFormulaMode && isEditable ? (
        <>
          <FormulaPicker
            value={value.formulaData?.formulaUuid}
            onSelect={(formula: UUMathFormulaDTO) => {
              onFormulaChange?.(valueIndex, {
                ...value.formulaData,
                formula: formula.expression,
                formulaUuid: formula.uuid,
                formulaName: formula.name,
                variableMapping: {},
                result: null,
                resolvedExpression: '',
                isValid: false,
              })
            }}
          />
          {value.formulaData?.formulaUuid && (
            <FormulaEditor
              key={value.formulaData?.formulaUuid}
              availableProperties={availableProperties}
              initialFormula={value.formulaData?.formula || ''}
              initialMapping={value.formulaData?.variableMapping}
              readOnlyExpression
              hideExpression
              onChange={(data) => {
                onFormulaChange?.(valueIndex, {
                  ...value.formulaData,
                  formula: data.formula,
                  variableMapping: data.variableMapping,
                  result: data.result,
                  resolvedExpression: data.resolvedExpression,
                  isValid: data.isValid,
                })
                if (data.result !== null && data.result !== undefined) {
                  onValueChange?.(valueIndex, data.result.toString())
                }
              }}
            />
          )}
        </>
      ) : isFormulaMode && !isEditable && hasFormula ? (
        <FormulaDisplay
          formula={value.formulaData!.formula}
          resolvedExpression={value.formulaData!.resolvedExpression}
          result={value.value ?? value.formulaData!.result}
          variableMapping={value.formulaData!.variableMapping}
        />
      ) : isEditable ? (
        <Input
          value={value.value || ''}
          onChange={(e) => onValueChange?.(valueIndex, e.target.value)}
          placeholder={t('objects.propertyValuePlaceholder')}
        />
      ) : (
        <div className="p-2 border rounded-md bg-background w-full">
          {formatNumericValue(value.value)}
        </div>
      )}

      {/* Value-level files — only in display mode */}
      {!isEditable && value.files && value.files.length > 0 && (
        <div className="mt-1">
          <FileList files={value.files} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PropertyItem — unified property display/edit component
// ---------------------------------------------------------------------------

export interface PropertyItemProps {
  property: Property
  isExpanded: boolean
  onToggle: () => void
  // Edit callbacks — if absent, display-only mode
  isEditable?: boolean
  onNameChange?: (newName: string) => void
  onValueChange?: (valueIndex: number, newValue: string) => void
  onValueFormulaChange?: (
    valueIndex: number,
    formulaData: FormulaData | undefined
  ) => void
  onAddValue?: () => void
  onRemoveValue?: (valueIndex: number) => void
  onRemove?: () => void
  availableProperties?: AvailableProperty[]
  onAttachFile?: (target: 'property' | 'value', valueIndex?: number) => void
  /** Show saving spinner on the property */
  isSaving?: boolean
  /** Validation error for the property name field */
  nameError?: string
  /** Extra content rendered inside the expanded card (e.g. file attachments) */
  children?: React.ReactNode
}

export function PropertyItem({
  property,
  isExpanded,
  onToggle,
  isEditable = false,
  onNameChange,
  onValueChange,
  onValueFormulaChange,
  onAddValue,
  onRemoveValue,
  onRemove,
  availableProperties = EMPTY_AVAILABLE_PROPERTIES,
  onAttachFile,
  isSaving = false,
  nameError,
  children,
}: PropertyItemProps) {
  const t = useTranslations()
  const values = property.values || []
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Check if any value has a formula
  const hasAnyFormula = values.some(
    (v: PropertyValue) => !!v.formulaData?.formula
  )

  // Property has data worth protecting from accidental delete
  const hasData =
    !!property.key?.trim() ||
    values.some((v: PropertyValue) => !!v.value?.trim())

  // Summary text for collapsed state
  const summaryText =
    values.length === 1
      ? values[0].formulaData?.formula
        ? `= ${formatNumericValue(values[0].value ?? values[0].formulaData.result) || '...'}`
        : formatNumericValue(values[0].value)
      : t('objects.values', { count: values.length })

  const propertyId = property.uuid || property._tempId || ''

  return (
    <div
      className={cn(
        'border rounded-md overflow-hidden',
        isExpanded && 'shadow-sm'
      )}
      data-testid={`property-item-${propertyId}`}
    >
      {/* Summary Row */}
      <div className="flex justify-between items-center">
        <div
          className={cn(
            'px-3 flex-1 flex items-center cursor-pointer hover:bg-muted/50',
            isExpanded ? 'py-2' : 'py-1.5'
          )}
          onClick={onToggle}
          data-testid={`property-header-${propertyId}`}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 mr-1.5 shrink-0 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
          <div className="font-medium text-sm flex items-center gap-1.5 min-w-0">
            <span className="truncate">
              {property.label || property.key || (
                <span className="text-muted-foreground italic">
                  {t('objects.propertyNamePlaceholder')}
                </span>
              )}
            </span>
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

          <div
            data-testid="property-summary-value"
            className="ml-3 text-sm text-muted-foreground truncate max-w-[40%]"
          >
            {summaryText}
          </div>
        </div>

        <div className="flex items-center gap-0.5 mr-1">
          {isSaving && (
            <span className="h-3.5 w-3.5 mr-1 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          {!isEditable && onAttachFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAttachFile('property')}
              className="h-7 px-1.5 text-muted-foreground"
              data-testid={`property-attach-file-${propertyId}`}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
          )}
          {isEditable &&
            onRemove &&
            (confirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmDelete(false)
                  onRemove()
                }}
                onBlur={() => setConfirmDelete(false)}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                data-testid={`property-delete-${propertyId}`}
              >
                {t('common.confirm')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (hasData) {
                    setConfirmDelete(true)
                  } else {
                    onRemove()
                  }
                }}
                className="h-7 w-7 p-0"
                data-testid={`property-delete-${propertyId}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ))}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 py-2 border-t bg-muted/10">
          {/* Property Name — only show in edit mode */}
          {isEditable && onNameChange && (
            <div className="mb-3">
              <Label
                htmlFor={`property-key-${propertyId || 'new'}`}
                className="text-xs"
              >
                {t('objects.propertyName')}
              </Label>
              <div className="flex items-center gap-1 mt-1">
                <Input
                  id={`property-key-${propertyId || 'new'}`}
                  value={property.key}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={t('objects.propertyNamePlaceholder')}
                  className={cn(
                    'h-8',
                    nameError &&
                      'border-destructive focus-visible:ring-destructive'
                  )}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={
                    nameError
                      ? `property-key-error-${propertyId || 'new'}`
                      : undefined
                  }
                  data-testid={`property-name-${propertyId}`}
                />
                {onAttachFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAttachFile('property')}
                    className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
                    data-testid={`property-attach-file-${propertyId}`}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {nameError && (
                <p
                  id={`property-key-error-${propertyId || 'new'}`}
                  className="text-xs text-destructive mt-1"
                  data-testid={`property-name-error-${propertyId}`}
                >
                  {nameError}
                </p>
              )}
            </div>
          )}

          {/* Property-level files — only in display mode */}
          {!isEditable && property.files && property.files.length > 0 && (
            <div className="mb-2">
              <FileList files={property.files} />
            </div>
          )}

          {/* Values Section */}
          <div>
            {(isEditable || values.length > 1) && (
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                {t('objects.propertyValues')}
              </h4>
            )}

            <div className="space-y-2">
              {values.map((value: PropertyValue, index: number) =>
                isEditable ? (
                  <PropertyValueItem
                    key={value.uuid || `new-${index}`}
                    value={value}
                    valueIndex={index}
                    propertyId={propertyId}
                    isEditable
                    availableProperties={availableProperties}
                    onValueChange={onValueChange}
                    onFormulaChange={onValueFormulaChange}
                    onRemove={onRemoveValue}
                    onAttachFile={
                      onAttachFile
                        ? () => onAttachFile('value', index)
                        : undefined
                    }
                    hideRemove={values.length <= 1}
                  />
                ) : (
                  <div
                    key={value.uuid || `val-${index}`}
                    data-testid={`property-value-${propertyId}-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {value.formulaData?.formula ? (
                          <FormulaDisplay
                            formula={value.formulaData.formula}
                            resolvedExpression={
                              value.formulaData.resolvedExpression
                            }
                            result={value.value ?? value.formulaData.result}
                            variableMapping={value.formulaData.variableMapping}
                          />
                        ) : (
                          <div className="text-sm">
                            {formatNumericValue(value.value) || (
                              <span className="text-muted-foreground italic">
                                -
                              </span>
                            )}
                          </div>
                        )}
                        {value.formulaData?.formulaName &&
                          !value.formulaData?.formula && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[10px] gap-0.5 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                            >
                              <FunctionSquare className="h-2.5 w-2.5" />
                              {value.formulaData.formulaName}
                            </Badge>
                          )}
                      </div>
                      {onAttachFile && value.uuid && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onAttachFile('value', index)}
                          className="-mr-2 h-7 px-1.5 text-muted-foreground shrink-0"
                          data-testid={`value-attach-file-${propertyId}-${index}`}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {/* Value-level files */}
                    {value.files && value.files.length > 0 && (
                      <div className="border-t pt-1.5 mt-1.5">
                        <FileList files={value.files} />
                      </div>
                    )}
                  </div>
                )
              )}

              {values.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  {t('objects.noValues')}
                </div>
              )}

              {isEditable && onAddValue && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddValue}
                  className="mt-1 h-7 text-xs"
                  data-testid={`property-add-value-${propertyId}`}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('common.add')}
                </Button>
              )}
            </div>
          </div>

          {/* Extra content injected by parent (e.g. file attachments) */}
          {children}
        </div>
      )}
    </div>
  )
}
