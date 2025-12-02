'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { 
  EnhancedMaterialObject, 
  EnhancedMaterialRelationship,
  LifecycleStage,
  FlowCategory 
} from '@/types'

interface NetworkDiagramProps {
  materials?: EnhancedMaterialObject[]
  relationships?: EnhancedMaterialRelationship[]
  selectedRelationship?: EnhancedMaterialRelationship | null
  onLinkSelect?: (relationship: EnhancedMaterialRelationship) => void
  onNodeSelect?: (material: EnhancedMaterialObject) => void
  className?: string
}

export function NetworkDiagram({
  materials = [],
  relationships = [],
  selectedRelationship,
  onLinkSelect,
  onNodeSelect,
  className = '',
}: NetworkDiagramProps) {
  const { chartOptions, stats } = useMemo(() => {
    if (!materials || materials.length === 0) {
      return { chartOptions: null, stats: null }
    }

    // Create categories for building-centric network layout
    const categories = [
      { name: 'Raw Materials', itemStyle: { color: '#1E40AF' } },
      { name: 'Processed Materials', itemStyle: { color: '#8B5CF6' } },
      { name: 'Existing Buildings', itemStyle: { color: '#047857' } },
      { name: 'Reclaimed Materials', itemStyle: { color: '#06B6D4' } },
      { name: 'Recycled Materials', itemStyle: { color: '#3B82F6' } },
      { name: 'New Buildings', itemStyle: { color: '#059669' } },
      { name: 'Recycling Facilities', itemStyle: { color: '#10B981' } },
      { name: 'Waste & Disposal', itemStyle: { color: '#DC2626' } },
    ]

    // Create nodes with building-centric positioning
    const nodes = materials.map((material) => {
      const { category, symbolSize, symbol, fixed, x, y } = getNodeProperties(material, materials)
      
      return {
        id: material.uuid,
        name: material.name,
        category,
        symbolSize,
        symbol,
        fixed,
        x,
        y,
        draggable: true, // Enable drag for all nodes
        itemStyle: {
          color: material.color,
          borderColor: getNodeBorderColor(material),
          borderWidth: getNodeBorderWidth(material),
          borderType: getNodeBorderType(material),
          shadowBlur: isBuildingNode(material) ? 15 : 8,
          shadowColor: isBuildingNode(material) ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.15)',
          shadowOffsetX: 2,
          shadowOffsetY: 2,
        },
        label: {
          show: true,
          position: getNodeLabelPosition(material),
          fontSize: getBuildingNodeFontSize(material),
          fontWeight: isBuildingNode(material) ? 'bold' : 'normal',
          color: isBuildingNode(material) ? '#1F2937' : '#374151',
          backgroundColor: isBuildingNode(material) ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
          padding: isBuildingNode(material) ? [4, 8] : [2, 4],
          borderRadius: isBuildingNode(material) ? 4 : 0,
        },
        tooltip: {
          formatter: createNodeTooltip(material),
        },
        original: material,
      }
    })

    // Create links with enhanced styling
    const links = relationships.map((rel) => {
      const isSelected = 
        selectedRelationship?.subject.uuid === rel.subject.uuid &&
        selectedRelationship?.object.uuid === rel.object.uuid &&
        selectedRelationship?.processName === rel.processName

      const { color, width, type: lineType, opacity } = getLinkProperties(rel, isSelected)

      return {
        source: rel.subject.uuid,
        target: rel.object.uuid,
        lineStyle: {
          color,
          width,
          type: lineType,
          opacity,
          curveness: 0.15,
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
        },
        emphasis: {
          lineStyle: {
            width: width + 2,
            opacity: 1,
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        tooltip: {
          formatter: createLinkTooltip(rel),
        },
        relationship: rel,
      }
    })

    // Calculate statistics
    const totalMaterials = materials.length
    const totalFlows = relationships.length
    const recyclingFlows = relationships.filter(rel => 
      rel.flowCategory === 'RECYCLING' || 
      rel.flowCategory === 'CIRCULAR' || 
      rel.flowCategory === 'REUSE'
    ).length
    const recyclingRate = totalFlows > 0 ? Math.round((recyclingFlows / totalFlows) * 100) : 0

    const buildingCount = materials.filter(m => 
      m.lifecycleStage === 'PRODUCT' || 
      m.lifecycleStage === 'USE_PHASE'
    ).length

    const reclaimedMaterials = materials.filter(m => m.isReusedComponent).length
    const recycledMaterials = materials.filter(m => m.isRecyclingMaterial).length

    const options = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#D1D5DB',
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: {
          fontSize: 12,
          color: '#374151',
        },
        extraCssText: 'box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);',
      },
      legend: {
        data: categories.map(cat => cat.name),
        orient: 'horizontal',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 13,
          color: '#374151',
          fontWeight: '500',
        },
        itemGap: 25,
        itemWidth: 14,
        itemHeight: 14,
      },
          series: [
        {
          type: 'graph',
          layout: 'none', // Use fixed positioning for building-centric layout
          data: nodes,
          links: links,
          categories: categories,
          roam: true,
          draggable: true, // Enable dragging
          focusNodeAdjacency: true,
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
          },
          label: {
            position: 'bottom',
            formatter: '{b}',
            fontSize: 11,
            fontWeight: 'normal',
            color: '#374151',
          },
          lineStyle: {
            color: 'source',
            curveness: 0.15,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4,
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0, 0, 0, 0.4)',
            },
          },
          // Remove force layout since we're using fixed positioning
        },
      ],
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    }

    return {
      chartOptions: options,
      stats: {
        totalMaterials,
        totalFlows,
        recyclingFlows,
        recyclingRate,
        buildingCount,
        reclaimedMaterials,
        recycledMaterials,
      },
    }
  }, [materials, relationships, selectedRelationship])

  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Network Statistics */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalMaterials}
            </div>
            <div className="text-sm text-blue-800">Materials</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {stats.buildingCount}
            </div>
            <div className="text-sm text-green-800">Buildings</div>
          </div>
          <div className="bg-cyan-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-cyan-600">
              {stats.reclaimedMaterials}
            </div>
            <div className="text-sm text-cyan-800">Reclaimed</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">
              {stats.recyclingRate}%
            </div>
            <div className="text-sm text-emerald-800">Circular Rate</div>
          </div>
        </div>
      )}

      {/* Network Chart */}
      <ReactECharts
        option={chartOptions}
        style={{ height: '700px', width: '100%' }}
        onEvents={{
          click: (params: any) => {
            if (params.dataType === 'edge' && params.data?.relationship && onLinkSelect) {
              onLinkSelect(params.data.relationship)
            } else if (params.dataType === 'node' && params.data?.original && onNodeSelect) {
              onNodeSelect(params.data.original)
            }
          },
        }}
        opts={{ renderer: 'canvas' }}
      />

      {/* Network Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Building-Centric Network Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Layout Structure</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#1E40AF' }}></div>
                <span><strong>Top:</strong> Raw Materials</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
                <span><strong>Upper:</strong> Processed Materials</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#047857' }}></div>
                <span><strong>Left:</strong> Existing Buildings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#059669' }}></div>
                <span><strong>Right:</strong> New Buildings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#10B981' }}></div>
                <span><strong>Center:</strong> Recycling Facilities</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: '#DC2626' }}></div>
                <span><strong>Bottom:</strong> Waste & Disposal</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Material Flow Paths</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-cyan-500 border-dashed rounded"></div>
                <span>Direct Reuse (Building → Building)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-green-500 border-dashed rounded"></div>
                <span>Recycling (Building → Facility → Building)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }}></div>
                <span>Waste Streams (Building → Disposal)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1E40AF' }}></div>
                <span>Virgin Materials (Raw → Building)</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Interactions</h4>
            <div className="space-y-1 text-xs">
              <div>• <strong>Drag any node</strong> to rearrange layout</div>
              <div>• <strong>Click buildings</strong> to see all connected materials</div>
              <div>• <strong>Click materials</strong> to see lifecycle details</div>
              <div>• <strong>Click flows</strong> to see process information</div>
              <div>• <strong>Hover</strong> to highlight material pathways</div>
              <div>• <strong>Zoom & Pan</strong> to explore the network</div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>💡 Building-Centric View:</strong> Each building acts as a hub with materials flowing in during construction 
            and out during deconstruction. Follow the material paths to see how components move between buildings, 
            get recycled, or become waste.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Get node properties with building-centric positioning
 */
function getNodeProperties(material: EnhancedMaterialObject, allMaterials: EnhancedMaterialObject[]) {
  let category = 0
  let symbolSize = 40
  let symbol = 'circle'
  let fixed = false
  let x = 0
  let y = 0

  // Building-centric layout positioning
  const buildings = allMaterials.filter(m => 
    m.lifecycleStage === 'USE_PHASE' || m.lifecycleStage === 'PRODUCT'
  )
  
  // Determine category and positioning based on lifecycle stage
  switch (material.lifecycleStage) {
    case 'PRIMARY_INPUT':
      category = 0 // Raw Materials
      symbolSize = 38 // Slightly larger for better visibility
      symbol = 'circle'
      // Position raw materials at the top
      x = Math.random() * 800 + 100
      y = 50
      break
      
    case 'PROCESSING':
      category = 1 // Processed Materials
      symbolSize = 42 // Slightly larger
      symbol = 'rect'
      // Position processed materials in upper area
      x = Math.random() * 800 + 100
      y = 150
      break
      
    case 'USE_PHASE':
      category = 2 // Existing Buildings
      symbolSize = 60 // Reduced size for better proportions
      symbol = 'roundRect'
      fixed = true // Fix building positions
      // Position existing buildings in left-center area
      const existingBuildingIndex = buildings.filter(b => b.lifecycleStage === 'USE_PHASE').indexOf(material)
      x = 200
      y = 300 + (existingBuildingIndex * 150)
      break
      
    case 'REUSED_COMPONENT':
      category = 3 // Reclaimed Materials
      symbolSize = 48 // Larger for emphasis
      symbol = 'diamond'
      // Position reclaimed materials between old and new buildings
      x = 500
      y = Math.random() * 400 + 250
      break
      
    case 'SECONDARY_INPUT':
      category = 4 // Recycled Materials
      symbolSize = 44 // Slightly larger
      symbol = 'triangle'
      // Position recycled materials in center-right area
      x = 600
      y = Math.random() * 200 + 350
      break
      
    case 'PRODUCT':
      category = 5 // New Buildings
      symbolSize = 60 // Reduced size for better proportions
      symbol = 'roundRect'
      fixed = true // Fix building positions
      // Position new buildings in right area
      const newBuildingIndex = buildings.filter(b => b.lifecycleStage === 'PRODUCT').indexOf(material)
      x = 800
      y = 300 + (newBuildingIndex * 150)
      break
      
    case 'WASTE':
      // Check if this is a recycling facility (processes waste)
      if (material.name.toLowerCase().includes('waste') && 
          allMaterials.some(m => m.lifecycleStage === 'SECONDARY_INPUT')) {
        category = 6 // Recycling Facilities
        symbolSize = 50
        symbol = 'rect'
        x = 500
        y = 550
      } else {
        category = 7 // Waste & Disposal
        symbolSize = 30
        symbol = 'circle'
        x = Math.random() * 200 + 700
        y = 600
      }
      break
      
    case 'DISPOSAL':
      category = 7 // Waste & Disposal
      symbolSize = 35
      symbol = 'circle'
      // Position disposal at bottom-right
      x = Math.random() * 200 + 700
      y = 650
      break
      
    default:
      // Fallback positioning
      if (material.type === 'input') {
        category = 0
        x = Math.random() * 800 + 100
        y = 100
      } else if (material.type === 'intermediate') {
        category = 1
        x = Math.random() * 600 + 200
        y = Math.random() * 400 + 200
      } else if (material.type === 'output') {
        category = 5
        x = Math.random() * 200 + 700
        y = Math.random() * 400 + 200
      }
  }

  return { category, symbolSize, symbol, fixed, x, y }
}

/**
 * Check if node is a building
 */
function isBuildingNode(material: EnhancedMaterialObject): boolean {
  return material.lifecycleStage === 'USE_PHASE' || material.lifecycleStage === 'PRODUCT'
}

/**
 * Get label position for different node types
 */
function getNodeLabelPosition(material: EnhancedMaterialObject): string {
  if (isBuildingNode(material)) {
    return 'bottom' // Move building labels outside like other elements
  }
  return 'bottom'
}

/**
 * Get font size for building nodes
 */
function getBuildingNodeFontSize(material: EnhancedMaterialObject): number {
  if (isBuildingNode(material)) {
    return 13 // Slightly larger font for buildings
  }
  return 10
}

/**
 * Get node border properties based on material characteristics
 */
function getNodeBorderColor(material: EnhancedMaterialObject): string {
  if (isBuildingNode(material)) return '#374151' // Subtle dark border for buildings
  if (material.isReusedComponent) return '#06B6D4' // Cyan for reused
  if (material.isRecyclingMaterial) return '#10B981' // Green for recycled
  return '#E5E7EB' // Light gray border for others
}

function getNodeBorderWidth(material: EnhancedMaterialObject): number {
  if (isBuildingNode(material)) return 2 // Reduced border width for buildings
  if (material.isReusedComponent || material.isRecyclingMaterial) return 3
  return 1
}

function getNodeBorderType(material: EnhancedMaterialObject): 'solid' | 'dashed' {
  if (material.isReusedComponent || material.isRecyclingMaterial) return 'dashed'
  return 'solid'
}

/**
 * Get link properties based on flow category and metadata
 */
function getLinkProperties(rel: EnhancedMaterialRelationship, isSelected: boolean) {
  let color = '#9CA3AF' // Softer default gray
  let width = 2
  let type: 'solid' | 'dashed' | 'dotted' = 'solid'
  let opacity = 0.7

  if (isSelected) {
    color = '#EF4444' // Bright red for selected
    width = 5
    opacity = 1
  } else {
    switch (rel.flowCategory) {
      case 'RECYCLING':
        color = '#059669' // Emerald green
        width = 3
        type = 'dashed'
        opacity = 0.8
        break
      case 'REUSE':
        color = '#0891B2' // Sky blue
        width = 4
        type = 'dashed'
        opacity = 0.9
        break
      case 'DOWNCYCLING':
        color = '#2563EB' // Blue
        width = 3
        type = 'dashed'
        opacity = 0.8
        break
      case 'CIRCULAR':
        color = '#047857' // Dark green
        width = 4
        type = 'dotted'
        opacity = 0.8
        break
      case 'WASTE_FLOW':
        color = '#D97706' // Amber
        width = 2
        type = 'dotted'
        opacity = 0.7
        break
      case 'STANDARD':
        color = '#6B7280' // Gray
        width = 2
        opacity = 0.6
        break
    }
  }

  return { color, width, type, opacity }
}

/**
 * Create enhanced node tooltip
 */
function createNodeTooltip(material: EnhancedMaterialObject): string {
  const parts = [
    `<strong>${material.name}</strong>`,
    `Type: ${material.type}`,
  ]

  if (material.lifecycleStage) {
    parts.push(`Lifecycle: ${material.lifecycleStage.replace('_', ' ')}`)
  }

  if (material.isReusedComponent) {
    parts.push(`🔄 <strong>Reused Component</strong>`)
  }

  if (material.isRecyclingMaterial) {
    parts.push(`♻️ <strong>Recycled Material</strong>`)
  }

  if (material.domainCategoryCode) {
    parts.push(`Category: ${material.domainCategoryCode}`)
  }

  if (material.sourceBuildingUuid) {
    parts.push(`Source: Building ${material.sourceBuildingUuid.slice(-8)}`)
  }

  if (material.targetBuildingUuid) {
    parts.push(`Target: Building ${material.targetBuildingUuid.slice(-8)}`)
  }

  return parts.join('<br/>')
}

/**
 * Create enhanced link tooltip
 */
function createLinkTooltip(rel: EnhancedMaterialRelationship): string {
  const parts = [
    `<strong>${rel.subject.name} → ${rel.object.name}</strong>`,
    `Quantity: ${rel.quantity?.toLocaleString() || 0} ${rel.unit || ''}`,
  ]

  if (rel.processName) {
    parts.push(`Process: ${rel.processName}`)
  }

  if (rel.flowCategory) {
    const categoryLabel = rel.flowCategory.replace('_', ' ').toLowerCase()
    const emoji = getFlowCategoryEmoji(rel.flowCategory)
    parts.push(`${emoji} Flow: ${categoryLabel}`)
  }

  if (rel.emissionsTotal && rel.emissionsTotal > 0) {
    parts.push(`🌍 Emissions: ${rel.emissionsTotal} ${rel.emissionsUnit || 'kgCO2e'}`)
  }

  if (rel.materialLossPercent && rel.materialLossPercent > 0) {
    parts.push(`⚠️ Loss: ${rel.materialLossPercent}%`)
  }

  if (rel.qualityChangeCode) {
    const qualityLabel = rel.qualityChangeCode === 'UP' ? 'Upcycled' : 
                        rel.qualityChangeCode === 'DOWN' ? 'Downcycled' : 'Same Quality'
    const qualityEmoji = rel.qualityChangeCode === 'UP' ? '⬆️' : 
                        rel.qualityChangeCode === 'DOWN' ? '⬇️' : '➡️'
    parts.push(`${qualityEmoji} Quality: ${qualityLabel}`)
  }

  return parts.join('<br/>')
}

/**
 * Get emoji for flow category
 */
function getFlowCategoryEmoji(category: FlowCategory): string {
  switch (category) {
    case 'RECYCLING':
      return '♻️'
    case 'REUSE':
      return '🔄'
    case 'DOWNCYCLING':
      return '⬇️'
    case 'CIRCULAR':
      return '🔄♻️'
    case 'WASTE_FLOW':
      return '🗑️'
    default:
      return '➡️'
  }
}
