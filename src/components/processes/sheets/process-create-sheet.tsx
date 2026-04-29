'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UUObjectDTO } from 'iom-sdk'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { ObjectSelectionModal } from '../modals/object-selection-modal'
import { ProcessMaterialList } from './process-material-list'
import type { MaterialRelationship } from '@/types'
import {
  MaterialFlowMetadata,
  ProcessCategory,
  FlowCategory,
  QualityChangeCode,
} from '@/types/sankey-metadata'
import { PROCESS_TYPES } from '@/constants'
import {
  PROCESS_CATEGORIES,
  FLOW_CATEGORY_OPTIONS,
  QUALITY_CHANGE_OPTIONS,
} from '../constants'
import {
  ProcessMaterial,
  ProcessFlowData,
  generateRelationships,
  validateProcessForm,
  formatCategoryName,
} from '../utils'

interface ProcessCreateSheetProps {
  isOpen: boolean
  onClose: () => void
  process?: ProcessFlowData
  onSave: (process: ProcessFlowData) => void
}

// Initial form state. Extracted so the constructor and the open-effect's
// "create new" branch share one definition — they used to drift.
function getEmptyProcessFormData(): ProcessFlowData {
  const now = new Date().toISOString()
  return {
    uuid: '',
    name: '',
    type: 'processing',
    description: '',
    inputMaterials: [],
    outputMaterials: [],
    relationships: [],
    processMetadata: {
      processName: '',
      processType: 'processing',
      quantity: 0,
      unit: 'kg',
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function ProcessCreateSheet({
  isOpen,
  onClose,
  process,
  onSave,
}: ProcessCreateSheetProps) {
  const t = useTranslations()
  const tProcessCategories = useTranslations('processCategories')
  const [formData, setFormData] = useState<ProcessFlowData>(
    getEmptyProcessFormData
  )

  // Modal states
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] =
    useState<ProcessMaterial | null>(null)
  const [materialType, setMaterialType] = useState<'input' | 'output'>('input')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      if (process) {
        setFormData({
          ...process,
          updatedAt: new Date().toISOString(),
        })
      } else {
        setFormData(getEmptyProcessFormData())
      }
    }
  }, [isOpen, process])

  // Patch processMetadata without scattering `formData.processMetadata!`
  // non-null assertions across every onChange — `processMetadata` is typed
  // as optional but is always present from getEmptyProcessFormData(), so
  // the assertion was effectively a "trust me" annotation. This helper
  // makes the safety explicit (default to empty object) and keeps the
  // type system honest.
  const updateMetadata = (patch: Record<string, unknown>) =>
    setFormData((prev) => ({
      ...prev,
      processMetadata: {
        ...(prev.processMetadata ?? {}),
        ...patch,
      },
    }))

  // Validation
  const validateForm = () => {
    const newErrors = validateProcessForm(formData, t)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle object selection for materials
  const handleObjectSave = (data: {
    object: UUObjectDTO
    quantity?: number
    unit?: string
    metadata?: MaterialFlowMetadata
    customProperties?: Record<string, string>
  }) => {
    const material: ProcessMaterial = {
      object: data.object,
      quantity: data.quantity,
      unit: data.unit,
      metadata: data.metadata,
      customProperties: data.customProperties,
    }

    if (editingMaterial) {
      // Update existing material
      const materialArray =
        materialType === 'input' ? 'inputMaterials' : 'outputMaterials'
      setFormData({
        ...formData,
        [materialArray]: formData[materialArray].map((m) =>
          m.object.uuid === editingMaterial.object.uuid ? material : m
        ),
      })
    } else {
      // Add new material
      const materialArray =
        materialType === 'input' ? 'inputMaterials' : 'outputMaterials'
      setFormData({
        ...formData,
        [materialArray]: [...formData[materialArray], material],
      })
    }

    // Clear duplicate errors when materials are added/edited (might resolve conflicts)
    if (errors.duplicates) {
      const newErrors = { ...errors }
      delete newErrors.duplicates
      setErrors(newErrors)
    }

    setEditingMaterial(null)
    setIsObjectModalOpen(false)
  }

  // Remove material
  const removeMaterial = (
    material: ProcessMaterial,
    type: 'input' | 'output'
  ) => {
    const materialArray =
      type === 'input' ? 'inputMaterials' : 'outputMaterials'
    setFormData({
      ...formData,
      [materialArray]: formData[materialArray].filter(
        (m) => m.object.uuid !== material.object.uuid
      ),
    })

    // Clear duplicate errors when removing materials (might resolve the conflict)
    if (errors.duplicates) {
      const newErrors = { ...errors }
      delete newErrors.duplicates
      setErrors(newErrors)
    }
  }

  // Edit material
  const editMaterial = (
    material: ProcessMaterial,
    type: 'input' | 'output'
  ) => {
    setEditingMaterial(material)
    setMaterialType(type)
    setIsObjectModalOpen(true)
  }

  // Add new material
  const addNewMaterial = (type: 'input' | 'output') => {
    setEditingMaterial(null)
    setMaterialType(type)
    setIsObjectModalOpen(true)
  }

  // Generate relationships from materials
  const handleGenerateRelationships = (): MaterialRelationship[] => {
    return generateRelationships(
      formData.inputMaterials,
      formData.outputMaterials,
      formData.name
    )
  }

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Ensure processMetadata has the form name and type synced
    const processData: ProcessFlowData = {
      ...formData,
      processMetadata: {
        ...(formData.processMetadata ?? {}),
        processName: formData.name,
        processType: formData.type,
      },
      relationships: handleGenerateRelationships(),
      updatedAt: new Date().toISOString(),
    }

    onSave(processData)
    onClose()
  }

  const selectedProcessType = PROCESS_TYPES.find(
    (p) => p.value === formData.type
  )

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader className="mb-5">
            <SheetTitle>
              {process
                ? t('processes.form.editTitle')
                : t('processes.form.createTitle')}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Process Information */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t('processes.form.processName')}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t('processes.form.processNamePlaceholder')}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                {/* Process Metadata */}
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="processCategory">
                        {t('processes.form.processCategory')}
                      </Label>
                      <Select
                        value={formData.processMetadata?.processCategory || ''}
                        onValueChange={(value) =>
                          updateMetadata({
                            processCategory: value as ProcessCategory,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              'processes.form.selectProcessCategory'
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {PROCESS_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {tProcessCategories(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="flowCategory">
                        {t('processes.form.flowType')}
                      </Label>
                      <Select
                        value={formData.processMetadata?.flowCategory || ''}
                        onValueChange={(value) =>
                          updateMetadata({
                            flowCategory: value as FlowCategory,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('processes.form.selectFlowType')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {FLOW_CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(`processes.flowCategories.${option.labelKey}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Process Impact Data */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emissionsTotal">
                        {t('processes.form.emissions')}
                      </Label>
                      <Input
                        id="emissionsTotal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.processMetadata?.emissionsTotal || ''}
                        onChange={(e) =>
                          updateMetadata({
                            emissionsTotal: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="materialLossPercent">
                        {t('processes.form.materialLoss')}
                      </Label>
                      <Input
                        id="materialLossPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={
                          formData.processMetadata?.materialLossPercent || ''
                        }
                        onChange={(e) =>
                          updateMetadata({
                            materialLossPercent: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {/* Quality Change */}
                  <div className="space-y-2">
                    <Label htmlFor="qualityChange">
                      {t('processes.form.qualityChange')}
                    </Label>
                    <Select
                      value={formData.processMetadata?.qualityChangeCode || ''}
                      onValueChange={(value) =>
                        updateMetadata({
                          qualityChangeCode: value as QualityChangeCode,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('processes.form.selectQualityChange')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_CHANGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(`processes.qualityChanges.${option.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Process Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="processNotes">
                      {t('processes.form.notes')}
                    </Label>
                    <Textarea
                      id="processNotes"
                      value={formData.processMetadata?.notes || ''}
                      onChange={(e) =>
                        updateMetadata({ notes: e.target.value })
                      }
                      placeholder={t('processes.form.notesPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <ProcessMaterialList
                  type="input"
                  materials={formData.inputMaterials}
                  error={errors.inputs}
                  onAdd={() => addNewMaterial('input')}
                  onEdit={(material) => editMaterial(material, 'input')}
                  onRemove={(material) => removeMaterial(material, 'input')}
                />
                <ProcessMaterialList
                  type="output"
                  materials={formData.outputMaterials}
                  error={errors.outputs}
                  onAdd={() => addNewMaterial('output')}
                  onEdit={(material) => editMaterial(material, 'output')}
                  onRemove={(material) => removeMaterial(material, 'output')}
                />
              </div>

              {/* Duplicate Materials Error */}
              {errors.duplicates && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t('processes.form.duplicateTitle')}</AlertTitle>
                  <AlertDescription>
                    <p>{errors.duplicates}</p>
                    <p className="mt-1 text-xs">
                      {t('processes.form.duplicateHint')}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Process Summary */}
              {formData.inputMaterials.length > 0 &&
                formData.outputMaterials.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {t('processes.flowSummary')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-blue-600">
                            {formData.inputMaterials.length}{' '}
                            {t('processes.inputs')}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <div className="font-medium">
                            {formData.name || t('processes.form.process')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedProcessType
                              ? t(
                                  `processes.types.${selectedProcessType.labelKey}`
                                )
                              : ''}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <div className="font-medium text-green-600">
                            {formData.outputMaterials.length}{' '}
                            {t('processes.outputs')}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground text-center">
                        {t('processes.relationships', {
                          count:
                            formData.inputMaterials.length *
                            formData.outputMaterials.length,
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              {/* Form Actions */}
              <SheetFooter className="w-full gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onClose}
                >
                  {t('processes.form.cancel')}
                </Button>

                <Button type="submit" className="w-full">
                  {process
                    ? t('processes.form.update')
                    : t('processes.form.create')}
                </Button>
              </SheetFooter>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Object Selection Modal */}
      <ObjectSelectionModal
        isOpen={isObjectModalOpen}
        onClose={() => {
          setIsObjectModalOpen(false)
          setEditingMaterial(null)
        }}
        onSave={handleObjectSave}
        showMetadataFields={true}
        initialData={
          editingMaterial
            ? {
                object: editingMaterial.object,
                quantity: editingMaterial.quantity || 0,
                unit: editingMaterial.unit || 'kg',
                metadata: editingMaterial.metadata,
                customProperties: editingMaterial.customProperties,
              }
            : undefined
        }
        title={t('objectSelection.title')}
      />
    </>
  )
}
