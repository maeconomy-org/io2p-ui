import type { MaterialRelationship } from '@/types'
import type { UUObjectDTO } from 'iom-sdk'

// Enhanced material with quantity, unit, and metadata for process flows
export interface ProcessMaterial {
  object: UUObjectDTO
  quantity?: number
  unit?: string
  metadata?: any
  customProperties?: Record<string, string>
}

export interface ProcessFlowData {
  uuid: string
  name: string
  type: string
  description?: string
  inputMaterials: ProcessMaterial[]
  outputMaterials: ProcessMaterial[]
  relationships: MaterialRelationship[]
  processMetadata?: any
  createdAt: string
  updatedAt: string
}

/**
 * Generate relationships from input and output materials
 */
export const generateRelationships = (
  inputMaterials: ProcessMaterial[],
  outputMaterials: ProcessMaterial[],
  processName: string
): MaterialRelationship[] => {
  const relationships: MaterialRelationship[] = []

  // Create IS_INPUT_OF relationships from inputs to outputs
  inputMaterials.forEach((input) => {
    outputMaterials.forEach((output) => {
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
        processName: processName,
      })
    })
  })

  return relationships
}

/**
 * Validate process form data
 */
export const validateProcessForm = (formData: ProcessFlowData): Record<string, string> => {
  const errors: Record<string, string> = {}

  if (!formData.name.trim()) {
    errors.name = 'Process name is required'
  }

  if (formData.inputMaterials.length === 0) {
    errors.inputs = 'At least one input material is required'
  }

  if (formData.outputMaterials.length === 0) {
    errors.outputs = 'At least one output material is required'
  }

  // Check for duplicate materials between inputs and outputs
  const inputUuids = new Set(formData.inputMaterials.map(m => m.object.uuid))
  const outputUuids = new Set(formData.outputMaterials.map(m => m.object.uuid))
  const duplicateUuids = [...inputUuids].filter(uuid => outputUuids.has(uuid))
  
  if (duplicateUuids.length > 0) {
    const duplicateMaterials = formData.inputMaterials
      .filter(m => duplicateUuids.includes(m.object.uuid))
      .map(m => m.object.name)
    
    errors.duplicates = `The following materials cannot be used as both input and output: ${duplicateMaterials.join(', ')}`
  }

  return errors
}

/**
 * Format category names for display
 */
export const formatCategoryName = (category: string): string => {
  return category.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}
