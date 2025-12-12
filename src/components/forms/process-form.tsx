'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Plus, Trash2, ArrowRight } from 'lucide-react'
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
  Textarea,
} from '@/components/ui'
import { ObjectSelectionModal } from '@/components/modals'
import type { MaterialRelationship } from '@/types'
import { 
  ProcessMetadata, 
  MaterialFlowMetadata, 
  ProcessCategory,
  FlowCategory,
} from '@/types/sankey-metadata'
import { PROCESS_TYPES } from '@/constants'

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

// Enhanced material with quantity, unit, and metadata for process flows
interface ProcessMaterial {
  object: UUObjectDTO
  quantity?: number
  unit?: string
  metadata?: MaterialFlowMetadata
  customProperties?: Record<string, string>
}

interface ProcessFlowData {
  uuid: string
  name: string
  type: string
  description?: string
  inputMaterials: ProcessMaterial[]
  outputMaterials: ProcessMaterial[]
  relationships: MaterialRelationship[]
  processMetadata?: ProcessMetadata
  createdAt: string
  updatedAt: string
}

interface ProcessFormProps {
  process?: ProcessFlowData
  onSave: (process: ProcessFlowData) => void
  onCancel: () => void
}

export default function ProcessForm({
  process,
  onSave,
  onCancel,
}: ProcessFormProps) {
  const [formData, setFormData] = useState<ProcessFlowData>({
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // Modal states
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] =
    useState<ProcessMaterial | null>(null)
  const [materialType, setMaterialType] = useState<'input' | 'output'>('input')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (process) {
      setFormData({
        ...process,
        updatedAt: new Date().toISOString(),
      })
    } else {
      setFormData({
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  }, [process])

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Process name is required'
    }

    if (formData.inputMaterials.length === 0) {
      newErrors.inputs = 'At least one input material is required'
    }

    if (formData.outputMaterials.length === 0) {
      newErrors.outputs = 'At least one output material is required'
    }

    // Check for duplicate materials between inputs and outputs
    const inputUuids = new Set(formData.inputMaterials.map(m => m.object.uuid))
    const outputUuids = new Set(formData.outputMaterials.map(m => m.object.uuid))
    const duplicateUuids = [...inputUuids].filter(uuid => outputUuids.has(uuid))
    
    if (duplicateUuids.length > 0) {
      const duplicateMaterials = formData.inputMaterials
        .filter(m => duplicateUuids.includes(m.object.uuid))
        .map(m => m.object.name)
      
      newErrors.duplicates = `The following materials cannot be used as both input and output: ${duplicateMaterials.join(', ')}`
    }

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
  const generateRelationships = (): MaterialRelationship[] => {
    const relationships: MaterialRelationship[] = []

    // Create IS_INPUT_OF relationships from inputs to outputs
    formData.inputMaterials.forEach((input) => {
      formData.outputMaterials.forEach((output) => {
        relationships.push({
          predicate: 'IS_INPUT_OF',
          subject: {
            uuid: input.object.uuid,
            name: input.object.name || 'Unnamed Object',
          },
          object: {
            uuid: output.object.uuid,
            name: output.object.name || 'Unnamed Object',
          },
          quantity: input.quantity || 0,
          unit: input.unit || '',
          processName: formData.name,
        })
      })
    })

    return relationships
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
        ...formData.processMetadata!,
        processName: formData.name,
        processType: formData.type,
      },
      relationships: generateRelationships(),
      updatedAt: new Date().toISOString(),
    }

    onSave(processData)
  }

  const selectedProcessType = PROCESS_TYPES.find(
    (p) => p.value === formData.type
  )

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Process Information */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Process Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Concrete Production, Steel Recycling"
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
                <Label htmlFor="processCategory">Process Category</Label>
                <Select 
                  value={formData.processMetadata?.processCategory || ''} 
                  onValueChange={(value) => setFormData({
                    ...formData,
                    processMetadata: {
                      ...formData.processMetadata!,
                      processCategory: value as ProcessCategory
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select process category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="flowCategory">Flow Type</Label>
                <Select 
                  value={formData.processMetadata?.flowCategory || ''} 
                  onValueChange={(value) => setFormData({
                    ...formData,
                    processMetadata: {
                      ...formData.processMetadata!,
                      flowCategory: value as FlowCategory
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select flow type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard Flow</SelectItem>
                    <SelectItem value="RECYCLING">Recycling</SelectItem>
                    <SelectItem value="REUSE">Reuse</SelectItem>
                    <SelectItem value="DOWNCYCLING">Downcycling</SelectItem>
                    <SelectItem value="CIRCULAR">Circular Flow</SelectItem>
                    <SelectItem value="WASTE_FLOW">Waste Flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Process Impact Data */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emissionsTotal">Carbon Emissions (Optional)</Label>
                <Input
                  id="emissionsTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.processMetadata?.emissionsTotal || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    processMetadata: {
                      ...formData.processMetadata!,
                      emissionsTotal: e.target.value ? Number(e.target.value) : undefined
                    }
                  })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materialLossPercent">Material Loss % (Optional)</Label>
                <Input
                  id="materialLossPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.processMetadata?.materialLossPercent || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    processMetadata: {
                      ...formData.processMetadata!,
                      materialLossPercent: e.target.value ? Number(e.target.value) : undefined
                    }
                  })}
                  placeholder="0.0"
                />
              </div>
            </div>

            {/* Quality Change */}
            <div className="space-y-2">
              <Label htmlFor="qualityChange">Quality Change (Optional)</Label>
              <Select 
                value={formData.processMetadata?.qualityChangeCode || ''} 
                onValueChange={(value) => setFormData({
                  ...formData,
                  processMetadata: {
                    ...formData.processMetadata!,
                    qualityChangeCode: value as any
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quality change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPCYCLED">Upcycled (Improved Quality)</SelectItem>
                  <SelectItem value="SAME">Same Quality</SelectItem>
                  <SelectItem value="DOWNCYCLED">Downcycled (Reduced Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Process Notes */}
            <div className="space-y-2">
              <Label htmlFor="processNotes">Process Notes (Optional)</Label>
              <Textarea
                id="processNotes"
                value={formData.processMetadata?.notes || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  processMetadata: {
                    ...formData.processMetadata!,
                    notes: e.target.value
                  }
                })}
                placeholder="Additional notes about this process..."
                rows={3}
              />
            </div>

          </div>
        </div>

        <div className="space-y-6">
          {/* Input Materials */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Input Materials
                  <Badge variant="outline">
                    {formData.inputMaterials.length}
                  </Badge>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewMaterial('input')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.inputMaterials.length > 0 ? (
                <div className="space-y-2">
                  {formData.inputMaterials.map((material) => (
                    <div
                      key={material.object.uuid}
                      className="flex items-center justify-between px-3 py-2 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {material.object.name}
                        </div>
                        {(material.quantity !== undefined || material.unit) && (
                          <div className="text-sm text-gray-500">
                            {material.quantity !== undefined
                              ? material.quantity
                              : ''}{' '}
                            {material.unit || ''}
                          </div>
                        )}
                        {material.metadata && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(material.metadata.lifecycleStage || material.metadata.inputLifecycleStage) && (
                              <Badge variant="outline" className="text-xs">
                                {(material.metadata.lifecycleStage || material.metadata.inputLifecycleStage)?.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {material.metadata.categoryCode && (
                              <Badge variant="secondary" className="text-xs">
                                {material.metadata.categoryCode}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editMaterial(material, 'input')}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMaterial(material, 'input')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Click "Add" to get started</p>
                </div>
              )}
              {errors.inputs && (
                <p className="text-sm text-red-500 mt-2">{errors.inputs}</p>
              )}
            </CardContent>
          </Card>

          {/* Output Materials */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Output Materials
                  <Badge variant="outline">
                    {formData.outputMaterials.length}
                  </Badge>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewMaterial('output')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.outputMaterials.length > 0 ? (
                <div className="space-y-2">
                  {formData.outputMaterials.map((material) => (
                    <div
                      key={material.object.uuid}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {material.object.name}
                        </div>
                        {(material.quantity !== undefined || material.unit) && (
                          <div className="text-sm text-gray-500">
                            {material.quantity !== undefined
                              ? material.quantity
                              : ''}{' '}
                            {material.unit || ''}
                          </div>
                        )}
                        {material.metadata && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(material.metadata.lifecycleStage || material.metadata.outputLifecycleStage) && (
                              <Badge variant="outline" className="text-xs">
                                {(material.metadata.lifecycleStage || material.metadata.outputLifecycleStage)?.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {material.metadata.categoryCode && (
                              <Badge variant="secondary" className="text-xs">
                                {material.metadata.categoryCode}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editMaterial(material, 'output')}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMaterial(material, 'output')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Click "Add" to get started</p>
                </div>
              )}
              {errors.outputs && (
                <p className="text-sm text-red-500 mt-2">{errors.outputs}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Duplicate Materials Error */}
        {errors.duplicates && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <h4 className="font-medium text-red-900 mb-1">Duplicate Materials Detected</h4>
                <p className="text-sm text-red-700">{errors.duplicates}</p>
                <p className="text-xs text-red-600 mt-1">
                  Please remove duplicate materials or use different materials for inputs and outputs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Process Summary */}
        {formData.inputMaterials.length > 0 &&
          formData.outputMaterials.length > 0 && (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-sm">Process Flow Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-blue-600">
                      {formData.inputMaterials.length} Inputs
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="text-center">
                    <div className="font-medium">
                      {formData.name || 'Process'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedProcessType?.label}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="text-center">
                    <div className="font-medium text-green-600">
                      {formData.outputMaterials.length} Outputs
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 text-center">
                  This will create{' '}
                  {formData.inputMaterials.length *
                    formData.outputMaterials.length}{' '}
                  material relationships
                </div>
              </CardContent>
            </Card>
          )}
        {/* Form Actions */}
        <div className="flex flex-col-reverse sm:flex-row w-full gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button type="submit" className="w-full">
            {process ? 'Update Process' : 'Create Process'}
          </Button>
        </div>
      </form>

      {/* Object Selection Modal */}
      <ObjectSelectionModal
        isOpen={isObjectModalOpen}
        onClose={() => {
          setIsObjectModalOpen(false)
          setEditingMaterial(null)
        }}
        onSave={handleObjectSave}
        materialType={materialType}
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
        title={
          editingMaterial
            ? `Edit ${materialType === 'input' ? 'Input' : 'Output'} Material`
            : `Add ${materialType === 'input' ? 'Input' : 'Output'} Material`
        }
      />
    </>
  )
}
