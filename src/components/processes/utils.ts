import type { MaterialRelationship, EnhancedMaterialRelationship } from '@/types'
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

/**
 * Detect and remove cycles from relationships to ensure DAG compliance
 */
export function detectAndRemoveCycles(relationships: EnhancedMaterialRelationship[]) {
  // Build adjacency list
  const graph = new Map<string, string[]>()
  const edgeMap = new Map<string, EnhancedMaterialRelationship>()
  
  // Initialize graph
  relationships.forEach((rel) => {
    const source = rel.subject.uuid
    const target = rel.object.uuid
    const edgeKey = `${source}->${target}`
    
    if (!graph.has(source)) {
      graph.set(source, [])
    }
    graph.get(source)!.push(target)
    edgeMap.set(edgeKey, rel)
  })

  // Detect cycles using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycles: string[][] = []
  const cyclicEdges = new Set<string>()

  function dfs(node: string, path: string[]): void {
    visited.add(node)
    recursionStack.add(node)
    
    const neighbors = graph.get(node) || []
    
    for (const neighbor of neighbors) {
      const edgeKey = `${node}->${neighbor}`
      
      if (recursionStack.has(neighbor)) {
        // Found a cycle - trace it back
        const cycleStart = path.indexOf(neighbor)
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart)
          cycles.push([...cycle, neighbor])
          
          // Mark all edges in this cycle as cyclic
          for (let i = cycleStart; i < path.length; i++) {
            const cycleEdge = `${path[i]}->${path[i + 1] || neighbor}`
            cyclicEdges.add(cycleEdge)
          }
          cyclicEdges.add(edgeKey)
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor])
      }
    }
    
    recursionStack.delete(node)
  }

  // Run DFS from all unvisited nodes
  for (const [node] of graph) {
    if (!visited.has(node)) {
      dfs(node, [node])
    }
  }

  // Separate valid and removed flows
  const validFlows: EnhancedMaterialRelationship[] = []
  const removedFlows: EnhancedMaterialRelationship[] = []

  relationships.forEach((rel) => {
    const edgeKey = `${rel.subject.uuid}->${rel.object.uuid}`
    if (cyclicEdges.has(edgeKey)) {
      removedFlows.push(rel)
    } else {
      validFlows.push(rel)
    }
  })

  // Create cycle info for user feedback
  const cycleInfo = {
    cycles: cycles.map(cycle => 
      cycle.map(nodeId => {
        // Try to find a readable name for the node
        const rel = relationships.find(r => r.subject.uuid === nodeId || r.object.uuid === nodeId)
        return rel?.subject.uuid === nodeId ? rel.subject.name : 
               rel?.object.uuid === nodeId ? rel.object.name : 
               nodeId.slice(0, 8) + '...'
      })
    ),
    removedCount: removedFlows.length,
    totalCycles: cycles.length,
  }

  return {
    validFlows,
    removedFlows,
    cycleInfo,
  }
}
