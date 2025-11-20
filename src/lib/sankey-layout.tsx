// lib/sankey-layout.ts
import { MaterialObject, MaterialRelationship } from '@/types'

export interface LayeredNode extends MaterialObject {
  layer: number
  x?: number
  y?: number
  position?: number
  isRecyclingRelated?: boolean
}

export interface LayoutResult {
  nodes: LayeredNode[]
  links: MaterialRelationship[]
  recyclingFlows: MaterialRelationship[]
  stats: {
    totalFlows: number
    recyclingFlows: number
    recyclingRate: string
  }
}

export function createLayeredLayout(
  materials: MaterialObject[] = [],
  relationships: MaterialRelationship[] = []
): LayoutResult {
  if (!materials || materials.length === 0) {
    return {
      nodes: [],
      links: [],
      recyclingFlows: [],
      stats: { totalFlows: 0, recyclingFlows: 0, recyclingRate: '0' },
    }
  }

  // Function to filter out cyclic relationships for DAG compliance
  function createDAGCompliantFlow(
    nodes: LayeredNode[],
    relationships: MaterialRelationship[]
  ): {
    nodes: LayeredNode[]
    links: MaterialRelationship[]
    recyclingFlows: MaterialRelationship[]
  } {
    const processedLinks: MaterialRelationship[] = []
    const recyclingFlows: MaterialRelationship[] = []

    relationships.forEach((rel) => {
      const sourceNode = nodes.find((n) => n.uuid === rel.subject.uuid)
      const targetNode = nodes.find((n) => n.uuid === rel.object.uuid)

      if (!sourceNode || !targetNode) return

      // Detect backward flows (potential cycles)
      const isBackwardFlow = sourceNode.layer >= targetNode.layer
      const isRecyclingProcess =
        rel.processName?.toLowerCase().includes('recycl') ||
        rel.processName?.toLowerCase().includes('reclaim') ||
        rel.subject.name.toLowerCase().includes('waste') ||
        rel.subject.name.toLowerCase().includes('scrap') ||
        rel.object.name.toLowerCase().includes('recycled')

      if (isBackwardFlow) {
        // This creates a cycle - track as recycling but don't include in DAG
        recyclingFlows.push(rel)
        console.log(
          `Cycle detected: ${rel.subject.name} (${sourceNode.layer}) → ${rel.object.name} (${targetNode.layer})`
        )
      } else {
        // Forward flow - safe for DAG
        processedLinks.push(rel)
        console.log(
          `Forward flow: ${rel.subject.name} (${sourceNode.layer}) → ${rel.object.name} (${targetNode.layer})`
        )
        if (isRecyclingProcess) {
          recyclingFlows.push(rel)
        }
      }
    })

    return { nodes, links: processedLinks, recyclingFlows }
  }

  // Build a dependency graph to better understand material flow
  function buildDependencyGraph(): Map<
    string,
    { inputs: Set<string>; outputs: Set<string> }
  > {
    const graph = new Map<
      string,
      { inputs: Set<string>; outputs: Set<string> }
    >()

    // Initialize graph nodes
    materials.forEach((material) => {
      graph.set(material.uuid, { inputs: new Set(), outputs: new Set() })
    })

    // Build connections based on relationships
    relationships.forEach((rel) => {
      const sourceNode = graph.get(rel.subject.uuid)
      const targetNode = graph.get(rel.object.uuid)

      if (sourceNode && targetNode) {
        if (rel.predicate === 'IS_INPUT_OF') {
          sourceNode.outputs.add(rel.object.uuid)
          targetNode.inputs.add(rel.subject.uuid)
        } else if (rel.predicate === 'IS_OUTPUT_OF') {
          targetNode.outputs.add(rel.subject.uuid)
          sourceNode.inputs.add(rel.object.uuid)
        }
      }
    })

    return graph
  }

  function getStageLevel(
    material: MaterialObject,
    graph: Map<string, { inputs: Set<string>; outputs: Set<string> }>
  ): number {
    const type = material.type?.toLowerCase() || ''
    const name = material.name?.toLowerCase() || ''
    const node = graph.get(material.uuid)

    // Check if this is a recycled material (part of circular flow)
    const isRecycled = name.includes('recycled') || name.includes('reclaimed')

    // Stage 0: Primary inputs and recycled materials
    if (type === 'input') {
      // Recycled materials get slightly different positioning for visual clarity
      return isRecycled ? 0.2 : 0
    }

    // Stage 1-2: Processing/intermediate - Use dependency depth for better layering
    if (type === 'intermediate') {
      const inputCount = node?.inputs.size || 0
      const outputCount = node?.outputs.size || 0

      // Calculate depth based on input materials
      let depth = 1.0
      
      // If this intermediate has inputs, it should be positioned after them
      if (inputCount > 0) {
        // Find the maximum layer of input materials
        let maxInputLayer = 0
        relationships.forEach(rel => {
          if (rel.object.uuid === material.uuid && rel.predicate === 'IS_INPUT_OF') {
            const inputMaterial = materials.find(m => m.uuid === rel.subject.uuid)
            if (inputMaterial) {
              const inputType = inputMaterial.type?.toLowerCase() || ''
              if (inputType === 'input') {
                maxInputLayer = Math.max(maxInputLayer, 0.5)
              } else if (inputType === 'intermediate') {
                maxInputLayer = Math.max(maxInputLayer, 1.0)
              }
            }
          }
        })
        depth = maxInputLayer + 0.5
      }

      // Specific material adjustments
      if (name.includes('concrete')) return Math.max(depth, 1.0)
      if (name.includes('lift') || name.includes('elevator')) return Math.max(depth, 1.8)
      if (name.includes('stairs')) return Math.max(depth, 1.6)
      if (name.includes('window')) return Math.max(depth, 1.4)
      if (name.includes('reinforced') || inputCount > 2) return Math.max(depth, 2.2)
      if (outputCount > 2) return Math.max(depth, 1.8) // Intermediate with many outputs
      
      return Math.max(depth, 1.5)
    }

    // Stage 3+: Outputs
    if (type === 'output') {
      // Final products
      if (name.includes('building') || name.includes('completed')) {
        return 3.8 // Final product
      }

      // Building components
      if (
        name.includes('foundation') ||
        name.includes('wall') ||
        name.includes('floor') ||
        name.includes('roof')
      ) {
        return 3.2 // Building components
      }

      // Waste streams (potential inputs to recycling)
      if (
        name.includes('waste') ||
        name.includes('scrap') ||
        name.includes('debris')
      ) {
        return 4.2 // Waste - positioned to flow back
      }

      // Environmental outputs (final disposal)
      if (
        name.includes('emission') ||
        name.includes('runoff') ||
        name.includes('landfill')
      ) {
        return 4.8 // Environmental/disposal - final stage
      }

      return 3.0 // Default outputs
    }

    return 1.5 // Default processing
  }

  // Build dependency graph for better layout
  const dependencyGraph = buildDependencyGraph()

  // Create nodes with proper staging
  const initialNodes: LayeredNode[] = materials.map((material) => {
    const layer = getStageLevel(material, dependencyGraph)
    const isRecyclingRelated =
      material.name.toLowerCase().includes('recycled') ||
      material.name.toLowerCase().includes('reclaimed')

    // Debug logging for layer assignment
    console.log(`Material: ${material.name} (${material.type}) → Layer: ${layer}`)

    return {
      ...material,
      layer,
      x: layer * 180, // Increased spacing for better visibility
      isRecyclingRelated,
    }
  })

  // Create DAG-compliant structure by filtering backward flows
  const {
    nodes: layeredNodes,
    links: allFlows,
    recyclingFlows,
  } = createDAGCompliantFlow(initialNodes, relationships)

  const totalQuantity = relationships.reduce(
    (sum, rel) => sum + (rel.quantity || 0),
    0
  )
  const recyclingQuantity = recyclingFlows.reduce(
    (sum, rel) => sum + (rel.quantity || 0),
    0
  )
  const recyclingRate =
    totalQuantity > 0
      ? ((recyclingQuantity / totalQuantity) * 100).toFixed(1)
      : '0'

  return {
    nodes: layeredNodes,
    links: allFlows, // Show ALL flows including recycling
    recyclingFlows,
    stats: {
      totalFlows: relationships.length,
      recyclingFlows: recyclingFlows.length,
      recyclingRate,
    },
  }
}

export function getStageColor(stage: number): string {
  if (stage <= 0.5) return '#1E40AF' // Deep Blue - Primary inputs
  if (stage < 1) return '#3B82F6' // Blue - Recycled inputs
  if (stage < 2) return '#8B5CF6' // Purple - Early processing
  if (stage < 3) return '#EF4444' // Red - Main processing
  if (stage < 3.5) return '#10B981' // Green - Products & Components
  if (stage < 4.5) return '#F59E0B' // Amber - Waste streams
  return '#DC2626' // Dark Red - Final disposal
}

export function getStageName(stage: number): string {
  if (stage <= 0.5) return 'Primary Material Inputs'
  if (stage < 1) return 'Recycled Material Inputs'
  if (stage < 2) return 'Early Processing'
  if (stage < 3) return 'Main Processing'
  if (stage < 3.5) return 'Products & Components'
  if (stage < 4.5) return 'Waste Streams'
  return 'Final Disposal & Environment'
}
