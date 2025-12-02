'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Plus, Trash2, ArrowRight, Info } from 'lucide-react'
import type { UUObjectDTO } from 'iom-sdk'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Textarea,
  Separator,
} from '@/components/ui'
import { ObjectSelectionModal } from '@/components/modals'
import type { 
  ProcessMetadata, 
  MaterialFlowMetadata, 
  ProcessCategory,
  LifecycleStage,
  FlowCategory,
  QualityChangeCode,
  DomainCategoryCode,
  DOMAIN_CATEGORY_CODES
} from '@/types'
import { PROCESS_TYPES } from '@/constants'

// Enhanced material with lifecycle and impact metadata
interface EnhancedProcessMaterial {
  object: UUObjectDTO
  quantity: number
  unit: string
  metadata?: MaterialFlowMetadata
}

interface EnhancedProcessFlowData {
  uuid: string
  name: string
  type: string
  description?: string
  processMetadata: ProcessMetadata
  inputMaterials: EnhancedProcessMaterial[]
  outputMaterials: EnhancedProcessMaterial[]
  createdAt: string
  updatedAt: string
}

interface EnhancedProcessFormProps {
  process?: EnhancedProcessFlowData
  onSave: (process: EnhancedProcessFlowData) => void
  onCancel: () => void
}

const PROCESS_CATEGORIES: ProcessCategory[] = [
  'CONSTRUCTION',
  'DECONSTRUCTION', 
  'SORTING',
  'RECYCLING',
  'REFURBISHMENT',
  'TRANSPORT',
  'DEMOLITION',
  'DISPOSAL'
]

const LIFECYCLE_STAGES: LifecycleStage[] = [
  'PRIMARY_INPUT',
  'SECONDARY_INPUT',
  'REUSED_COMPONENT',
  'PROCESSING',
  'COMPONENT',
  'PRODUCT',
  'USE_PHASE',
  'WASTE',
  'DISPOSAL'
]

const FLOW_CATEGORIES: FlowCategory[] = [
  'STANDARD',
  'RECYCLING',
  'REUSE',
  'DOWNCYCLING',
  'CIRCULAR',
  'WASTE_FLOW'
]

const QUALITY_CHANGE_CODES: QualityChangeCode[] = ['UP', 'SAME', 'DOWN']

export default function EnhancedProcessForm({
  process,
  onSave,
  onCancel,
}: EnhancedProcessFormProps) {
  const [formData, setFormData] = useState<EnhancedProcessFlowData>({
    uuid: '',
    name: '',
    type: 'processing',
    description: '',
    processMetadata: {
      processName: '',
      processType: 'processing',
      quantity: 0,
      unit: 'kg',
    },
    inputMaterials: [],
    outputMaterials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // Modal states
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<EnhancedProcessMaterial | null>(null)
  const [materialType, setMaterialType] = useState<'input' | 'output'>('input')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (process) {
      setFormData({
        ...process,
        updatedAt: new Date().toISOString(),
      })
    }
  }, [process])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Process name is required'
    }

    if (!formData.processMetadata.processName.trim()) {
      newErrors.processName = 'Process name is required'
    }

    if (formData.inputMaterials.length === 0) {
      newErrors.inputs = 'At least one input material is required'
    }

    if (formData.outputMaterials.length === 0) {
      newErrors.outputs = 'At least one output material is required'
    }

    // Validate materials have required quantity
    formData.inputMaterials.forEach((material, index) => {
      if (!material.quantity || material.quantity <= 0) {
        newErrors[`input_${index}_quantity`] = 'Quantity must be greater than 0'
      }
    })

    formData.outputMaterials.forEach((material, index) => {
      if (!material.quantity || material.quantity <= 0) {
        newErrors[`output_${index}_quantity`] = 'Quantity must be greater than 0'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Ensure processMetadata has the form name
    const updatedFormData = {
      ...formData,
      processMetadata: {
        ...formData.processMetadata,
        processName: formData.name,
        processType: formData.type,
      },
      updatedAt: new Date().toISOString(),
    }

    onSave(updatedFormData)
  }

  const handleAddMaterial = (type: 'input' | 'output') => {
    setMaterialType(type)
    setEditingMaterial(null)
    setIsObjectModalOpen(true)
  }

  const handleEditMaterial = (material: EnhancedProcessMaterial, type: 'input' | 'output') => {
    setMaterialType(type)
    setEditingMaterial(material)
    setIsObjectModalOpen(true)
  }

  const handleSaveMaterial = (data: { object: UUObjectDTO; quantity: number; unit: string }) => {
    const newMaterial: EnhancedProcessMaterial = {
      object: data.object,
      quantity: data.quantity,
      unit: data.unit,
      metadata: editingMaterial?.metadata || {},
    }

    if (editingMaterial) {
      // Update existing material
      if (materialType === 'input') {
        setFormData(prev => ({
          ...prev,
          inputMaterials: prev.inputMaterials.map(m =>
            m.object.uuid === editingMaterial.object.uuid ? newMaterial : m
          ),
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          outputMaterials: prev.outputMaterials.map(m =>
            m.object.uuid === editingMaterial.object.uuid ? newMaterial : m
          ),
        }))
      }
    } else {
      // Add new material
      if (materialType === 'input') {
        setFormData(prev => ({
          ...prev,
          inputMaterials: [...prev.inputMaterials, newMaterial],
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          outputMaterials: [...prev.outputMaterials, newMaterial],
        }))
      }
    }

    setIsObjectModalOpen(false)
    setEditingMaterial(null)
  }

  const handleRemoveMaterial = (uuid: string, type: 'input' | 'output') => {
    if (type === 'input') {
      setFormData(prev => ({
        ...prev,
        inputMaterials: prev.inputMaterials.filter(m => m.object.uuid !== uuid),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        outputMaterials: prev.outputMaterials.filter(m => m.object.uuid !== uuid),
      }))
    }
  }

  const updateMaterialMetadata = (
    uuid: string, 
    type: 'input' | 'output', 
    metadata: Partial<MaterialFlowMetadata>
  ) => {
    if (type === 'input') {
      setFormData(prev => ({
        ...prev,
        inputMaterials: prev.inputMaterials.map(m =>
          m.object.uuid === uuid 
            ? { ...m, metadata: { ...m.metadata, ...metadata } }
            : m
        ),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        outputMaterials: prev.outputMaterials.map(m =>
          m.object.uuid === uuid 
            ? { ...m, metadata: { ...m.metadata, ...metadata } }
            : m
        ),
      }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Process Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Process Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Process Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter process name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Process Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select process type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROCESS_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the process..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Process Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Lifecycle & Sustainability Metadata
            <Info className="h-4 w-4 text-blue-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="processCategory">Process Category</Label>
              <Select
                value={formData.processMetadata.processCategory || ''}
                onValueChange={(value: ProcessCategory) => 
                  setFormData(prev => ({
                    ...prev,
                    processMetadata: { ...prev.processMetadata, processCategory: value }
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESS_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Process Characteristics</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecycling"
                    checked={formData.processMetadata.isRecycling || false}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        processMetadata: { ...prev.processMetadata, isRecycling: !!checked }
                      }))
                    }
                  />
                  <Label htmlFor="isRecycling" className="text-sm">
                    ♻️ Recycling Process
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isDeconstruction"
                    checked={formData.processMetadata.isDeconstruction || false}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        processMetadata: { ...prev.processMetadata, isDeconstruction: !!checked }
                      }))
                    }
                  />
                  <Label htmlFor="isDeconstruction" className="text-sm">
                    🏗️ Deconstruction / End-of-Life
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceBuildingUuid">Source Building (Optional)</Label>
              <Input
                id="sourceBuildingUuid"
                value={formData.processMetadata.sourceBuildingUuid || ''}
                onChange={(e) => 
                  setFormData(prev => ({
                    ...prev,
                    processMetadata: { ...prev.processMetadata, sourceBuildingUuid: e.target.value }
                  }))
                }
                placeholder="UUID of source building"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetBuildingUuid">Target Building (Optional)</Label>
              <Input
                id="targetBuildingUuid"
                value={formData.processMetadata.targetBuildingUuid || ''}
                onChange={(e) => 
                  setFormData(prev => ({
                    ...prev,
                    processMetadata: { ...prev.processMetadata, targetBuildingUuid: e.target.value }
                  }))
                }
                placeholder="UUID of target building"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Input Materials
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddMaterial('input')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Input
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.inputs && <p className="text-sm text-red-500 mb-4">{errors.inputs}</p>}
          <div className="space-y-4">
            {formData.inputMaterials.map((material, index) => (
              <MaterialCard
                key={material.object.uuid}
                material={material}
                type="input"
                index={index}
                onEdit={() => handleEditMaterial(material, 'input')}
                onRemove={() => handleRemoveMaterial(material.object.uuid, 'input')}
                onUpdateMetadata={(metadata) => 
                  updateMaterialMetadata(material.object.uuid, 'input', metadata)
                }
                errors={errors}
              />
            ))}
            {formData.inputMaterials.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No input materials added yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Output Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Output Materials
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddMaterial('output')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Output
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.outputs && <p className="text-sm text-red-500 mb-4">{errors.outputs}</p>}
          <div className="space-y-4">
            {formData.outputMaterials.map((material, index) => (
              <MaterialCard
                key={material.object.uuid}
                material={material}
                type="output"
                index={index}
                onEdit={() => handleEditMaterial(material, 'output')}
                onRemove={() => handleRemoveMaterial(material.object.uuid, 'output')}
                onUpdateMetadata={(metadata) => 
                  updateMaterialMetadata(material.object.uuid, 'output', metadata)
                }
                errors={errors}
              />
            ))}
            {formData.outputMaterials.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No output materials added yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {process ? 'Update Process' : 'Create Process'}
        </Button>
      </div>

      {/* Object Selection Modal */}
      <ObjectSelectionModal
        isOpen={isObjectModalOpen}
        onClose={() => setIsObjectModalOpen(false)}
        onSave={handleSaveMaterial}
        title={`Select ${materialType === 'input' ? 'Input' : 'Output'} Material`}
        initialData={editingMaterial ? {
          object: editingMaterial.object,
          quantity: editingMaterial.quantity,
          unit: editingMaterial.unit,
        } : undefined}
      />
    </form>
  )
}

// Enhanced Material Card Component with Metadata
interface MaterialCardProps {
  material: EnhancedProcessMaterial
  type: 'input' | 'output'
  index: number
  onEdit: () => void
  onRemove: () => void
  onUpdateMetadata: (metadata: Partial<MaterialFlowMetadata>) => void
  errors: Record<string, string>
}

function MaterialCard({ 
  material, 
  type, 
  index, 
  onEdit, 
  onRemove, 
  onUpdateMetadata, 
  errors 
}: MaterialCardProps) {
  const [showMetadata, setShowMetadata] = useState(false)
  const metadata = material.metadata || {}

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Basic Material Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            {type === 'input' ? '📥' : '📤'} {type}
          </Badge>
          <div>
            <p className="font-medium">{material.object.name}</p>
            <p className="text-sm text-gray-500">
              {material.quantity} {material.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            {showMetadata ? 'Hide' : 'Show'} Metadata
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata Section */}
      {showMetadata && (
        <>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lifecycle Metadata */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Lifecycle & Classification</h4>
              
              <div className="space-y-2">
                <Label className="text-xs">Lifecycle Stage</Label>
                <Select
                  value={metadata[`${type}LifecycleStage`] || ''}
                  onValueChange={(value: LifecycleStage) => 
                    onUpdateMetadata({ [`${type}LifecycleStage`]: value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Material Category</Label>
                <Select
                  value={metadata[`${type}CategoryCode`] || ''}
                  onValueChange={(value: DomainCategoryCode) => 
                    onUpdateMetadata({ [`${type}CategoryCode`]: value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOMAIN_CATEGORY_CODES).map(([code, description]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Flow Category</Label>
                <Select
                  value={metadata.flowCategory || ''}
                  onValueChange={(value: FlowCategory) => 
                    onUpdateMetadata({ flowCategory: value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select flow type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOW_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${material.object.uuid}-reused`}
                    checked={metadata.isReusedInput || false}
                    onCheckedChange={(checked) =>
                      onUpdateMetadata({ isReusedInput: !!checked })
                    }
                  />
                  <Label htmlFor={`${material.object.uuid}-reused`} className="text-xs">
                    🔄 Reused Component
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${material.object.uuid}-recycled`}
                    checked={metadata.isRecyclingMaterial || false}
                    onCheckedChange={(checked) =>
                      onUpdateMetadata({ isRecyclingMaterial: !!checked })
                    }
                  />
                  <Label htmlFor={`${material.object.uuid}-recycled`} className="text-xs">
                    ♻️ Recycled Material
                  </Label>
                </div>
              </div>
            </div>

            {/* Impact Metadata */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Environmental Impact</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Emissions (kgCO2e)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={metadata.emissionsTotal || ''}
                    onChange={(e) => 
                      onUpdateMetadata({ 
                        emissionsTotal: e.target.value ? parseFloat(e.target.value) : undefined 
                      })
                    }
                    placeholder="0.00"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Material Loss (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={metadata.materialLossPercent || ''}
                    onChange={(e) => 
                      onUpdateMetadata({ 
                        materialLossPercent: e.target.value ? parseFloat(e.target.value) : undefined 
                      })
                    }
                    placeholder="0.0"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Quality Change</Label>
                <Select
                  value={metadata.qualityChangeCode || ''}
                  onValueChange={(value: QualityChangeCode) => 
                    onUpdateMetadata({ qualityChangeCode: value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select quality change" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_CHANGE_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code === 'UP' ? '⬆️ Upcycled' : 
                         code === 'DOWN' ? '⬇️ Downcycled' : 
                         '➡️ Same Quality'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={metadata.notes || ''}
                  onChange={(e) => onUpdateMetadata({ notes: e.target.value })}
                  placeholder="Additional notes about this flow..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error Messages */}
      {errors[`${type}_${index}_quantity`] && (
        <p className="text-sm text-red-500">{errors[`${type}_${index}_quantity`]}</p>
      )}
    </div>
  )
}

