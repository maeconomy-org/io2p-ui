'use client'

import { useState } from 'react'
import {
  Control,
  useFieldArray,
  useWatch,
  useFormContext,
} from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { Label } from '@/components/ui'
import {
  AttachmentModal,
  AttachmentList,
} from '@/components/object-sheets/components'
import { PropertyItem } from './property-item'
import type { FormulaData } from './types'
import type { AvailableProperty } from './hooks/use-formula-evaluation'

const EMPTY_AVAILABLE_PROPERTIES: AvailableProperty[] = []

interface PropertyItemRHFProps {
  control: Control<any>
  name: string
  index: number
  onRemove: () => void
  availableProperties?: AvailableProperty[]
  /** When true, disables formula and file features (used for templates) */
  templateMode?: boolean
}

/**
 * React Hook Form adapter for PropertyItem.
 * Bridges RHF's useWatch/setValue to PropertyItem's callback interface.
 * Replaces both PropertyField and PropertyFieldTemplate.
 */
export function PropertyItemRHF({
  control,
  name,
  index,
  onRemove,
  availableProperties = EMPTY_AVAILABLE_PROPERTIES,
  templateMode = false,
}: PropertyItemRHFProps) {
  const t = useTranslations()
  const { setValue } = useFormContext()
  const valuesName = `${name}.values`
  const filesName = `${name}.files`

  // Watch the full property to pass to PropertyItem
  const propertyData = useWatch({ control, name })

  // Field array for values
  const { append: appendValue, remove: removeValue } = useFieldArray({
    control,
    name: valuesName,
  })

  // Expansion state — always expanded in form context
  const [isExpanded, setIsExpanded] = useState(true)

  // File modal state
  const [openValueFileIndex, setOpenValueFileIndex] = useState<number | null>(
    null
  )
  const [isPropertyFilesOpen, setIsPropertyFilesOpen] = useState(false)

  // Build a Property-shaped object from watched data
  const property = {
    uuid: propertyData?.uuid,
    key: propertyData?.key || '',
    label: propertyData?.label,
    values: propertyData?.values || [],
    files: propertyData?.files || [],
    _tempId: propertyData?._tempId,
    _isNew: propertyData?._isNew,
  }

  const handleNameChange = (newName: string) => {
    setValue(`${name}.key`, newName)
  }

  const handleValueChange = (valueIndex: number, newValue: string) => {
    setValue(`${valuesName}.${valueIndex}.value`, newValue)
  }

  const handleFormulaChange = (
    valueIndex: number,
    formulaData: FormulaData | undefined
  ) => {
    setValue(`${valuesName}.${valueIndex}.formulaData`, formulaData)
    // If formula produces a result, store it in the value field too
    if (formulaData?.result !== null && formulaData?.result !== undefined) {
      setValue(
        `${valuesName}.${valueIndex}.value`,
        formulaData.result.toString()
      )
    }
  }

  const handleAddValue = () => {
    appendValue({
      value: '',
      formula: '',
      files: [],
    })
  }

  const handleRemoveValue = (valueIndex: number) => {
    removeValue(valueIndex)
  }

  const handleAttachFile = templateMode
    ? undefined
    : (target: 'property' | 'value', valueIndex?: number) => {
        if (target === 'property') {
          setIsPropertyFilesOpen(true)
        } else if (valueIndex !== undefined) {
          setOpenValueFileIndex(valueIndex)
        }
      }

  return (
    <PropertyItem
      property={property}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      isEditable
      onNameChange={handleNameChange}
      onValueChange={handleValueChange}
      onValueFormulaChange={templateMode ? undefined : handleFormulaChange}
      onAddValue={handleAddValue}
      onRemoveValue={handleRemoveValue}
      onRemove={onRemove}
      availableProperties={templateMode ? undefined : availableProperties}
      onAttachFile={handleAttachFile}
    >
      {/* File modals + file lists — only in non-template mode */}
      {!templateMode && (
        <div className="space-y-2">
          <PropertyFilesSection
            control={control}
            filesName={filesName}
            isOpen={isPropertyFilesOpen}
            setIsOpen={setIsPropertyFilesOpen}
          />

          {(property.values || []).map((_val: any, valueIndex: number) => (
            <ValueFilesModal
              key={`file-modal-${valueIndex}`}
              control={control}
              valuesName={valuesName}
              valueIndex={valueIndex}
              isOpen={openValueFileIndex === valueIndex}
              onOpenChange={(open) =>
                setOpenValueFileIndex(open ? valueIndex : null)
              }
            />
          ))}
        </div>
      )}
    </PropertyItem>
  )
}

// ---------------------------------------------------------------------------
// Sub-components for file handling (RHF-specific)
// ---------------------------------------------------------------------------

function PropertyFilesSection({
  control,
  filesName,
  isOpen,
  setIsOpen,
}: {
  control: Control<any>
  filesName: string
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}) {
  const t = useTranslations()
  const files = useWatch({ control, name: filesName }) || []
  const { setValue } = useFormContext()

  if (files.length === 0 && !isOpen) return null

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <>
          <Label className="text-sm">{t('objects.fields.files')}</Label>
          <AttachmentList attachments={files} />
        </>
      )}
      <AttachmentModal
        open={isOpen}
        onOpenChange={setIsOpen}
        attachments={files}
        onChange={(newFiles: any) => setValue(filesName, newFiles)}
        title={t('objects.attachFilesProperty')}
      />
    </div>
  )
}

function ValueFilesModal({
  control,
  valuesName,
  valueIndex,
  isOpen,
  onOpenChange,
}: {
  control: Control<any>
  valuesName: string
  valueIndex: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const files =
    useWatch({
      control,
      name: `${valuesName}.${valueIndex}.files`,
    }) || []
  const { setValue } = useFormContext()

  if (files.length === 0 && !isOpen) return null

  return (
    <div className="space-y-1">
      {files.length > 0 && (
        <>
          <Label className="text-xs text-muted-foreground">
            {t('objects.fields.files')}
          </Label>
          <AttachmentList attachments={files} />
        </>
      )}
      <AttachmentModal
        open={isOpen}
        onOpenChange={onOpenChange}
        attachments={files}
        onChange={(newFiles: any) =>
          setValue(`${valuesName}.${valueIndex}.files`, newFiles)
        }
        title={t('objects.attachFilesValue')}
      />
    </div>
  )
}
