import { useState, useEffect } from 'react'

import {
  Control,
  Controller,
  useFieldArray,
  useWatch,
  useFormContext,
} from 'react-hook-form'
import { PlusIcon, UploadIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  AttachmentModal,
  AttachmentList,
} from '@/components/object-sheets/components'
import {
  Button,
  Input,
  Label,
  FormItem,
  FormField,
  FormControl,
  FormMessage,
} from '@/components/ui'
import { FormulaEditor } from './formula-editor'
import { ValueModeToggle } from './value-mode-toggle'
import type { AvailableProperty } from './hooks/use-formula-evaluation'

const EMPTY_AVAILABLE_PROPERTIES: AvailableProperty[] = []

interface PropertyFieldProps {
  control: Control<any>
  name: string
  index: number
  onRemove: () => void
  availableProperties?: AvailableProperty[]
}

interface ValueFieldItemProps {
  control: Control<any>
  valuesName: string
  valueIndex: number
  valueField: any
  arrayVersion: number
  availableProperties: AvailableProperty[]
  canRemove: boolean
  onRemove: () => void
  openValueIndex: number | null
  setOpenValueIndex: (index: number | null) => void
}

function ValueFieldItem({
  control,
  valuesName,
  valueIndex,
  valueField,
  arrayVersion,
  availableProperties,
  canRemove,
  onRemove,
  openValueIndex,
  setOpenValueIndex,
}: ValueFieldItemProps) {
  const t = useTranslations()
  const { setValue } = useFormContext()

  // Watch formulaData to initialize mode
  const formulaData = useWatch({
    control,
    name: `${valuesName}.${valueIndex}.formulaData`,
  })

  const [isFormulaMode, setIsFormulaMode] = useState(!!formulaData?.formula)

  const switchToTextMode = () => {
    if (!isFormulaMode) return
    setIsFormulaMode(false)
    // Keep result as the text value, clear formulaData
    setValue(
      `${valuesName}.${valueIndex}.value`,
      formulaData?.result?.toString() || ''
    )
    setValue(`${valuesName}.${valueIndex}.formulaData`, undefined)
  }

  const switchToFormulaMode = () => {
    if (isFormulaMode) return
    setIsFormulaMode(true)
    setValue(`${valuesName}.${valueIndex}.formulaData`, {
      formula: '',
      variableMapping: {},
      result: null,
      isValid: false,
    })
  }

  return (
    <div className="space-y-2 border rounded-md p-2 bg-muted/5">
      {/* Value Label + Toggle + Actions */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          {t('objects.propertyValue')}
        </Label>
        <div className="flex items-center gap-1">
          <ValueModeToggle
            isFormulaMode={isFormulaMode}
            onTextMode={switchToTextMode}
            onFormulaMode={switchToFormulaMode}
          />

          {/* Upload + Delete buttons (always visible) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpenValueIndex(valueIndex)}
            data-tour="property-value-upload"
          >
            <UploadIcon className="h-4 w-4" />
          </Button>

          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRemove}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Value Input (full width) */}
      {isFormulaMode ? (
        <Controller
          control={control}
          name={`${valuesName}.${valueIndex}.formulaData`}
          render={({ field }) => (
            <FormulaEditor
              availableProperties={availableProperties}
              initialFormula={field.value?.formula || ''}
              initialMapping={field.value?.variableMapping}
              onChange={(data) => {
                field.onChange({
                  formula: data.formula,
                  variableMapping: data.variableMapping,
                  result: data.result,
                  resolvedExpression: data.resolvedExpression,
                  isValid: data.isValid,
                })
                // Update the value field with the result
                setValue(
                  `${valuesName}.${valueIndex}.value`,
                  data.result?.toString() || ''
                )
              }}
            />
          )}
        />
      ) : (
        <FormField
          key={`${valueField.id}-${arrayVersion}`}
          control={control}
          name={`${valuesName}.${valueIndex}.value`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder={t('objects.propertyValuePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* File Attachments */}
      <Controller
        key={`${valueField.id}-files-${arrayVersion}`}
        control={control}
        name={`${valuesName}.${valueIndex}.files`}
        render={({ field }) => (
          <div className="space-y-2">
            {(field.value?.length || 0) > 0 && (
              <Label className="text-xs text-muted-foreground">
                {t('objects.fields.files')}
              </Label>
            )}
            <AttachmentList attachments={field.value || []} />
            <AttachmentModal
              open={openValueIndex === valueIndex}
              onOpenChange={(open) =>
                setOpenValueIndex(open ? valueIndex : null)
              }
              attachments={field.value || []}
              onChange={field.onChange}
              title={t('objects.attachFilesValue')}
            />
          </div>
        )}
      />
    </div>
  )
}

export function PropertyField({
  control,
  name,
  index,
  onRemove,
  availableProperties = EMPTY_AVAILABLE_PROPERTIES,
}: PropertyFieldProps) {
  const t = useTranslations()
  const valuesName = `${name}.values`
  const filesName = `${name}.files`

  const {
    fields: valueFields,
    append: appendValue,
    remove: removeValue,
  } = useFieldArray({
    control,
    name: valuesName,
  })

  const handleAddValue = () => {
    appendValue({
      value: '',
      formula: '',
      files: [],
    })
  }

  // Modal state: value-level tracks which index is open; property-level separate
  const [openValueIndex, setOpenValueIndex] = useState<number | null>(null)
  const [isPropertyFilesOpen, setIsPropertyFilesOpen] = useState(false)

  // Version counter to force re-rendering when array changes
  const [arrayVersion, setArrayVersion] = useState(0)

  // Force re-render when field array length changes
  useEffect(() => {
    setArrayVersion((prev) => prev + 1)
  }, [valueFields.length])

  return (
    <div className="border rounded-md p-3 space-y-4">
      <div className="flex items-start justify-between">
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`property-${index}`} className="text-sm">
              {t('objects.propertyName')}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRemove}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-between items-center gap-2">
            <FormField
              control={control}
              name={`${name}.key`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      id={`property-${index}`}
                      placeholder={t('objects.propertyNamePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPropertyFilesOpen(true)}
              data-tour="property-name-upload"
              data-testid="attach-file-button"
            >
              <UploadIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Controller
              control={control}
              name={filesName}
              render={({ field }) => (
                <div className="mt-1 space-y-2">
                  {(field.value?.length || 0) > 0 && (
                    <Label className="text-sm">
                      {t('objects.fields.files')}
                    </Label>
                  )}
                  <AttachmentList attachments={field.value || []} />
                  <AttachmentModal
                    open={isPropertyFilesOpen}
                    onOpenChange={setIsPropertyFilesOpen}
                    attachments={field.value || []}
                    onChange={field.onChange}
                    title={t('objects.attachFilesProperty')}
                  />
                </div>
              )}
            />
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="space-y-3">
        <Label className="text-sm">{t('objects.propertyValues')}</Label>

        {valueFields.map((valueField, valueIndex) => (
          <ValueFieldItem
            key={valueField.id}
            control={control}
            valuesName={valuesName}
            valueIndex={valueIndex}
            valueField={valueField}
            arrayVersion={arrayVersion}
            availableProperties={availableProperties}
            canRemove={valueFields.length > 1}
            onRemove={() => removeValue(valueIndex)}
            openValueIndex={openValueIndex}
            setOpenValueIndex={setOpenValueIndex}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleAddValue}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('objects.addAnotherValue')}
        </Button>
      </div>
    </div>
  )
}
