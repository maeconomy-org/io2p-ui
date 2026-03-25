import type {
  MaterialRelationship,
  EnhancedMaterialRelationship,
  EnhancedMaterialObject,
} from '@/types'
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
export const validateProcessForm = (
  formData: ProcessFlowData,
  t: (key: string, values?: Record<string, any>) => string
): Record<string, string> => {
  const errors: Record<string, string> = {}

  if (!formData.name.trim()) {
    errors.name = t('processes.errors.nameRequired')
  }

  if (formData.inputMaterials.length === 0) {
    errors.inputs = t('processes.errors.inputsRequired')
  }

  if (formData.outputMaterials.length === 0) {
    errors.outputs = t('processes.errors.outputsRequired')
  }

  // Check for duplicate materials between inputs and outputs
  const inputUuids = new Set(formData.inputMaterials.map((m) => m.object.uuid))
  const outputUuids = new Set(
    formData.outputMaterials.map((m) => m.object.uuid)
  )
  const duplicateUuids = [...inputUuids].filter((uuid) => outputUuids.has(uuid))

  if (duplicateUuids.length > 0) {
    const duplicateMaterials = formData.inputMaterials
      .filter((m) => duplicateUuids.includes(m.object.uuid))
      .map((m) => m.object.name)

    errors.duplicates = t('processes.errors.duplicate', {
      materials: duplicateMaterials.join(', '),
    })
  }

  return errors
}

/**
 * Format category names for display
 */
export const formatCategoryName = (category: string): string => {
  return category
    .replace('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

/**
 * Limit Sankey diagram to show only `maxLevels` topological levels.
 * Computes depth via BFS from pure input nodes (depth 0).
 * Keeps only nodes with depth < maxLevels.
 *
 * Example: Water/Sand(0) → Brick(1) → Hotel Wall(2) → Hotel Building(3)
 * With maxLevels=3: keeps depths 0,1,2 → Hotel Building excluded.
 */
export function limitSankeyDepth(
  materials: EnhancedMaterialObject[],
  relationships: EnhancedMaterialRelationship[],
  maxLevels = 3
): {
  materials: EnhancedMaterialObject[]
  relationships: EnhancedMaterialRelationship[]
  truncatedCount: number
} {
  if (relationships.length === 0 || materials.length === 0) {
    return { materials, relationships, truncatedCount: 0 }
  }

  // Build forward adjacency (subject → object[])
  const forwardAdj = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()

  // Initialize all nodes
  const allNodeIds = new Set<string>()
  relationships.forEach((r) => {
    allNodeIds.add(r.subject.uuid)
    allNodeIds.add(r.object.uuid)
  })
  allNodeIds.forEach((id) => {
    forwardAdj.set(id, new Set())
    inDegree.set(id, 0)
  })

  // Build graph
  relationships.forEach((r) => {
    forwardAdj.get(r.subject.uuid)!.add(r.object.uuid)
    inDegree.set(r.object.uuid, (inDegree.get(r.object.uuid) || 0) + 1)
  })

  // Find pure input nodes (in-degree 0)
  const roots: string[] = []
  inDegree.forEach((deg, id) => {
    if (deg === 0) roots.push(id)
  })

  // BFS from roots to compute topological depth
  const depth = new Map<string, number>()
  const queue: string[] = [...roots]
  roots.forEach((id) => depth.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current)!
    const children = forwardAdj.get(current)
    if (children) {
      children.forEach((child) => {
        // Use max depth (longest path) to handle diamond patterns
        const existingDepth = depth.get(child)
        const newDepth = currentDepth + 1
        if (existingDepth === undefined || newDepth > existingDepth) {
          depth.set(child, newDepth)
          queue.push(child)
        }
      })
    }
  }

  // Keep only nodes with depth < maxLevels
  const keptNodes = new Set<string>()
  depth.forEach((d, id) => {
    if (d < maxLevels) keptNodes.add(id)
  })

  // Also keep nodes that weren't reached by BFS (isolated or in cycles)
  materials.forEach((m) => {
    if (!depth.has(m.uuid)) keptNodes.add(m.uuid)
  })

  const filteredMaterials = materials.filter((m) => keptNodes.has(m.uuid))
  const filteredRelationships = relationships.filter(
    (r) => keptNodes.has(r.subject.uuid) && keptNodes.has(r.object.uuid)
  )

  return {
    materials: filteredMaterials,
    relationships: filteredRelationships,
    truncatedCount: materials.length - filteredMaterials.length,
  }
}

/**
 * Compute topological depth for statement UUIDs without needing full objects.
 * Used to filter participating UUIDs before fetching objects.
 * Returns only UUIDs within the depth limit.
 *
 * When focusNode is provided, BFS starts from that node instead of graph roots,
 * enabling drill-down navigation (always showing maxLevels from the focus point).
 */
export function limitStatementDepth(
  statements: Array<{ subject: string; object: string }>,
  maxLevels: number,
  focusNode?: string
): Set<string> {
  if (statements.length === 0) return new Set()

  // Build forward adjacency and in-degree
  const forwardAdj = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  const allIds = new Set<string>()

  statements.forEach((s) => {
    allIds.add(s.subject)
    allIds.add(s.object)
  })
  allIds.forEach((id) => {
    forwardAdj.set(id, new Set())
    inDegree.set(id, 0)
  })

  statements.forEach((s) => {
    forwardAdj.get(s.subject)!.add(s.object)
    inDegree.set(s.object, (inDegree.get(s.object) || 0) + 1)
  })

  // BFS starting points: focusNode if provided, otherwise graph roots (in-degree 0)
  const startNodes: string[] = []
  if (focusNode && allIds.has(focusNode)) {
    startNodes.push(focusNode)
  } else {
    inDegree.forEach((deg, id) => {
      if (deg === 0) startNodes.push(id)
    })
  }

  const depth = new Map<string, number>()
  const queue: string[] = [...startNodes]
  startNodes.forEach((id) => depth.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current)!
    const children = forwardAdj.get(current)
    if (children) {
      children.forEach((child) => {
        const existingDepth = depth.get(child)
        const newDepth = currentDepth + 1
        if (existingDepth === undefined || newDepth > existingDepth) {
          depth.set(child, newDepth)
          queue.push(child)
        }
      })
    }
  }

  // Return only UUIDs within depth limit
  const kept = new Set<string>()
  depth.forEach((d, id) => {
    if (d < maxLevels) kept.add(id)
  })

  // When no focusNode, include unreachable nodes (isolated/cycles)
  if (!focusNode) {
    allIds.forEach((id) => {
      if (!depth.has(id)) kept.add(id)
    })
  }

  return kept
}

/**
 * Bidirectional depth limiting from a focus node.
 * Traverses both backward (inputs/parents) and forward (outputs/children)
 * up to `maxLevels` hops in each direction, placing the focus node in the middle.
 *
 * Example with maxLevels=3 and focus on "Brick":
 *   Water(−1) → Brick(0) → Hotel Wall(1) → Hotel Building(2)
 *   Sand(−1)  ↗
 * Keeps all nodes within 3 hops upstream and 3 hops downstream.
 */
export function limitStatementDepthBidirectional(
  statements: Array<{ subject: string; object: string }>,
  maxLevels: number,
  focusNode: string
): Set<string> {
  if (statements.length === 0) return new Set()

  // Build forward (subject → object) and backward (object → subject) adjacency
  const forwardAdj = new Map<string, Set<string>>()
  const backwardAdj = new Map<string, Set<string>>()
  const allIds = new Set<string>()

  statements.forEach((s) => {
    allIds.add(s.subject)
    allIds.add(s.object)
  })

  allIds.forEach((id) => {
    forwardAdj.set(id, new Set())
    backwardAdj.set(id, new Set())
  })

  statements.forEach((s) => {
    forwardAdj.get(s.subject)!.add(s.object)
    backwardAdj.get(s.object)!.add(s.subject)
  })

  if (!allIds.has(focusNode)) return new Set()

  const kept = new Set<string>()
  kept.add(focusNode)

  // BFS forward (downstream/outputs)
  const forwardQueue: Array<{ id: string; depth: number }> = [
    { id: focusNode, depth: 0 },
  ]
  const forwardVisited = new Set<string>([focusNode])

  while (forwardQueue.length > 0) {
    const { id, depth } = forwardQueue.shift()!
    if (depth >= maxLevels) continue
    const children = forwardAdj.get(id)
    if (children) {
      children.forEach((child) => {
        kept.add(child)
        if (!forwardVisited.has(child)) {
          forwardVisited.add(child)
          forwardQueue.push({ id: child, depth: depth + 1 })
        }
      })
    }
  }

  // BFS backward (upstream/inputs)
  const backwardQueue: Array<{ id: string; depth: number }> = [
    { id: focusNode, depth: 0 },
  ]
  const backwardVisited = new Set<string>([focusNode])

  while (backwardQueue.length > 0) {
    const { id, depth } = backwardQueue.shift()!
    if (depth >= maxLevels) continue
    const parents = backwardAdj.get(id)
    if (parents) {
      parents.forEach((parent) => {
        kept.add(parent)
        if (!backwardVisited.has(parent)) {
          backwardVisited.add(parent)
          backwardQueue.push({ id: parent, depth: depth + 1 })
        }
      })
    }
  }

  return kept
}

/**
 * Detect and remove cycles from relationships to ensure DAG compliance
 */
export function detectAndRemoveCycles(
  relationships: EnhancedMaterialRelationship[]
) {
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
    cycles: cycles.map((cycle) =>
      cycle.map((nodeId) => {
        // Try to find a readable name for the node
        const rel = relationships.find(
          (r) => r.subject.uuid === nodeId || r.object.uuid === nodeId
        )
        return rel?.subject.uuid === nodeId
          ? rel.subject.name
          : rel?.object.uuid === nodeId
            ? rel.object.name
            : nodeId.slice(0, 8) + '...'
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
