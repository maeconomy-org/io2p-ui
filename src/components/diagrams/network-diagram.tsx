'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Card, CardContent } from '@/components/ui'
import { Package, Building2, Recycle, TrendingUp } from 'lucide-react'
import type { 
  EnhancedMaterialObject, 
  EnhancedMaterialRelationship,
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

    // Simplified categories with better colors
    const categories = [
      { name: 'Raw Materials', itemStyle: { color: '#3B82F6' } },      // Blue
      { name: 'Processed', itemStyle: { color: '#8B5CF6' } },           // Purple
      { name: 'Existing Buildings', itemStyle: { color: '#059669' } }, // Emerald
      { name: 'Reclaimed', itemStyle: { color: '#06B6D4' } },          // Cyan
      { name: 'Recycled', itemStyle: { color: '#10B981' } },           // Green
      { name: 'New Buildings', itemStyle: { color: '#0891B2' } },      // Teal
      { name: 'Recycling Hub', itemStyle: { color: '#F59E0B' } },      // Amber
      { name: 'Waste', itemStyle: { color: '#EF4444' } },              // Red
    ]

    // Create nodes with positioning
    const nodes = materials.map((material) => {
      const { category, symbolSize, symbol, x, y } = getNodeProperties(material, materials)
      const isBuilding = isBuildingNode(material)
      
      return {
        id: material.uuid,
        name: material.name,
        category,
        symbolSize,
        symbol,
        x,
        y,
        draggable: true,
        itemStyle: {
          color: material.color || categories[category]?.itemStyle.color,
          borderColor: isBuilding ? '#1F2937' : '#E5E7EB',
          borderWidth: isBuilding ? 2 : 1,
          shadowBlur: isBuilding ? 12 : 4,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
        },
        label: {
          show: true,
          position: 'bottom',
          distance: 8,
          fontSize: isBuilding ? 12 : 10,
          fontWeight: isBuilding ? '600' : '400',
          color: '#374151',
          formatter: '{b}',
        },
        tooltip: {
          formatter: createNodeTooltip(material),
        },
        original: material,
      }
    })

    // Create links
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
          curveness: 0.2,
        },
        emphasis: {
          lineStyle: {
            width: width + 2,
            opacity: 1,
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
    const circularRate = totalFlows > 0 ? Math.round((recyclingFlows / totalFlows) * 100) : 0

    const buildingCount = materials.filter(m => 
      m.lifecycleStage === 'PRODUCT' || 
      m.lifecycleStage === 'USE_PHASE'
    ).length

    const options = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        borderRadius: 8,
        padding: [10, 14],
        textStyle: {
          fontSize: 12,
          color: '#374151',
        },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);',
      },
      legend: {
        show: false, // Hide default legend, we'll use custom
      },
      series: [
        {
          type: 'graph',
          layout: 'none',
          data: nodes,
          links: links,
          categories: categories,
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          lineStyle: {
            curveness: 0.2,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4,
            },
            itemStyle: {
              shadowBlur: 16,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut',
    }

    return {
      chartOptions: options,
      stats: {
        totalMaterials,
        totalFlows,
        recyclingFlows,
        circularRate,
        buildingCount,
      },
    }
  }, [materials, relationships, selectedRelationship])

  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.totalMaterials}</div>
                  <div className="text-xs text-muted-foreground">Materials</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.buildingCount}</div>
                  <div className="text-xs text-muted-foreground">Buildings</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100">
                  <Recycle className="h-4 w-4 text-cyan-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.recyclingFlows}</div>
                  <div className="text-xs text-muted-foreground">Circular Flows</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.circularRate}%</div>
                  <div className="text-xs text-muted-foreground">Circular Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Network Chart */}
      <Card>
        <CardContent className="p-0">
          <ReactECharts
            option={chartOptions}
            style={{ height: '600px', width: '100%' }}
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
        </CardContent>
      </Card>

      {/* Simplified Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">Flow Types:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-emerald-500" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: '#059669' }}></div>
            <span>Recycling</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-cyan-500" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: '#06B6D4' }}></div>
            <span>Reuse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-gray-400"></div>
            <span>Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-amber-500" style={{ borderStyle: 'dotted', borderWidth: '2px', borderColor: '#F59E0B' }}></div>
            <span>Waste</span>
          </div>
        </div>
        <span className="text-muted-foreground/50">•</span>
        <span>Drag nodes to rearrange • Scroll to zoom • Click flows for details</span>
      </div>
    </div>
  )
}

/**
 * Get node properties with positioning - spreads nodes evenly to avoid overlaps
 */
function getNodeProperties(material: EnhancedMaterialObject, allMaterials: EnhancedMaterialObject[]) {
  let category = 0
  let symbolSize = 35
  let symbol = 'circle'
  let x = 0
  let y = 0

  // Group materials by lifecycle stage for even distribution
  const primaryInputs = allMaterials.filter(m => m.lifecycleStage === 'PRIMARY_INPUT' || (!m.lifecycleStage && m.type === 'input'))
  const processed = allMaterials.filter(m => m.lifecycleStage === 'PROCESSING')
  const existingBuildings = allMaterials.filter(m => m.lifecycleStage === 'USE_PHASE')
  const newBuildings = allMaterials.filter(m => m.lifecycleStage === 'PRODUCT')
  const reused = allMaterials.filter(m => m.lifecycleStage === 'REUSED_COMPONENT')
  const recycled = allMaterials.filter(m => m.lifecycleStage === 'SECONDARY_INPUT')
  const waste = allMaterials.filter(m => m.lifecycleStage === 'WASTE' || m.lifecycleStage === 'DISPOSAL')
  
  // Chart dimensions
  const chartWidth = 900
  const chartHeight = 600
  const padding = 80
  
  switch (material.lifecycleStage) {
    case 'PRIMARY_INPUT': {
      category = 0
      symbolSize = 30
      symbol = 'circle'
      // Spread evenly across top row
      const idx = primaryInputs.indexOf(material)
      const count = primaryInputs.length
      const spacing = (chartWidth - padding * 2) / Math.max(count, 1)
      x = padding + (idx * spacing) + spacing / 2
      y = 60
      break
    }
      
    case 'PROCESSING': {
      category = 1
      symbolSize = 34
      symbol = 'rect'
      // Spread in second row
      const idx = processed.indexOf(material)
      const count = processed.length
      const spacing = (chartWidth - padding * 2) / Math.max(count, 1)
      x = padding + (idx * spacing) + spacing / 2
      y = 160
      break
    }
      
    case 'USE_PHASE': {
      category = 2
      symbolSize = 48
      symbol = 'roundRect'
      // Left side, vertically distributed
      const idx = existingBuildings.indexOf(material)
      const count = existingBuildings.length
      const verticalSpacing = Math.min(100, (chartHeight - 200) / Math.max(count, 1))
      x = 120
      y = 280 + (idx * verticalSpacing)
      break
    }
      
    case 'REUSED_COMPONENT': {
      category = 3
      symbolSize = 38
      symbol = 'diamond'
      // Center-left area
      const idx = reused.indexOf(material)
      const count = reused.length
      const verticalSpacing = Math.min(80, 300 / Math.max(count, 1))
      x = 350
      y = 260 + (idx * verticalSpacing)
      break
    }
      
    case 'SECONDARY_INPUT': {
      category = 4
      symbolSize = 36
      symbol = 'triangle'
      // Center-right area
      const idx = recycled.indexOf(material)
      const count = recycled.length
      const verticalSpacing = Math.min(80, 300 / Math.max(count, 1))
      x = 550
      y = 280 + (idx * verticalSpacing)
      break
    }
      
    case 'PRODUCT': {
      category = 5
      symbolSize = 48
      symbol = 'roundRect'
      // Right side, vertically distributed
      const idx = newBuildings.indexOf(material)
      const count = newBuildings.length
      const verticalSpacing = Math.min(100, (chartHeight - 200) / Math.max(count, 1))
      x = chartWidth - 120
      y = 280 + (idx * verticalSpacing)
      break
    }
      
    case 'WASTE': {
      if (material.name.toLowerCase().includes('recycl')) {
        category = 6
        symbolSize = 40
        symbol = 'rect'
        x = 450
        y = 520
      } else {
        category = 7
        symbolSize = 26
        symbol = 'circle'
        const idx = waste.filter(m => !m.name.toLowerCase().includes('recycl')).indexOf(material)
        x = 650 + (idx * 60)
        y = 540
      }
      break
    }
      
    case 'DISPOSAL': {
      category = 7
      symbolSize = 26
      symbol = 'circle'
      const idx = waste.indexOf(material)
      x = 700 + (idx * 50)
      y = 560
      break
    }
      
    default: {
      // Fallback with better distribution
      if (material.type === 'input') {
        category = 0
        const idx = primaryInputs.indexOf(material)
        const count = primaryInputs.length || 1
        x = padding + ((idx >= 0 ? idx : 0) * (chartWidth - padding * 2) / count) + 50
        y = 80
      } else if (material.type === 'intermediate') {
        category = 1
        x = 300 + (allMaterials.filter(m => m.type === 'intermediate').indexOf(material) * 80)
        y = 300
      } else {
        category = 5
        const outputs = allMaterials.filter(m => m.type === 'output')
        const idx = outputs.indexOf(material)
        x = chartWidth - 150
        y = 250 + (idx * 80)
      }
    }
  }

  return { category, symbolSize, symbol, x, y }
}

function isBuildingNode(material: EnhancedMaterialObject): boolean {
  return material.lifecycleStage === 'USE_PHASE' || material.lifecycleStage === 'PRODUCT'
}

function getLinkProperties(rel: EnhancedMaterialRelationship, isSelected: boolean) {
  let color = '#9CA3AF'
  let width = 2
  let type: 'solid' | 'dashed' | 'dotted' = 'solid'
  let opacity = 0.6

  const inputQuantity = rel.inputMaterial?.quantity || 1
  const baseWidth = Math.max(1.5, Math.min(6, Math.log10(inputQuantity + 1) * 2))

  if (isSelected) {
    color = '#EF4444'
    width = baseWidth + 2
    opacity = 1
  } else {
    switch (rel.flowCategory) {
      case 'RECYCLING':
        color = '#059669'
        width = Math.max(baseWidth, 2.5)
        type = 'dashed'
        opacity = 0.8
        break
      case 'REUSE':
        color = '#06B6D4'
        width = Math.max(baseWidth, 3)
        type = 'dashed'
        opacity = 0.85
        break
      case 'DOWNCYCLING':
        color = '#3B82F6'
        width = Math.max(baseWidth, 2.5)
        type = 'dashed'
        opacity = 0.75
        break
      case 'CIRCULAR':
        color = '#047857'
        width = Math.max(baseWidth, 3)
        type = 'dotted'
        opacity = 0.8
        break
      case 'WASTE_FLOW':
        color = '#F59E0B'
        width = baseWidth
        type = 'dotted'
        opacity = 0.65
        break
      default:
        width = baseWidth
        break
    }
  }

  return { color, width, type, opacity }
}

function createNodeTooltip(material: EnhancedMaterialObject): string {
  const parts = [
    `<strong>${material.name}</strong>`,
    `Type: ${material.type}`,
  ]

  if (material.lifecycleStage) {
    parts.push(`Lifecycle: ${material.lifecycleStage.replace(/_/g, ' ')}`)
    
    if (material.lifecycleStage === 'SECONDARY_INPUT') {
      parts.push(`♻️ Recycled Material`)
    } else if (material.lifecycleStage === 'REUSED_COMPONENT') {
      parts.push(`🔄 Reused Component`)
    }
  }

  if (material.domainCategoryCode) {
    parts.push(`Category: ${material.domainCategoryCode}`)
  }

  return parts.join('<br/>')
}

function createLinkTooltip(rel: EnhancedMaterialRelationship): string {
  const parts = [
    `<strong>${rel.subject.name} → ${rel.object.name}</strong>`,
  ]

  if (rel.processName) {
    parts.push(`Process: ${rel.processName}`)
  }

  if (rel.processTypeCode) {
    parts.push(`Type: ${rel.processTypeCode.replace(/_/g, ' ')}`)
  }

  if (rel.flowCategory && rel.flowCategory !== 'STANDARD') {
    const emoji = getFlowCategoryEmoji(rel.flowCategory)
    parts.push(`${emoji} ${rel.flowCategory.replace(/_/g, ' ').toLowerCase()}`)
  }

  if (rel.emissionsTotal && rel.emissionsTotal > 0) {
    parts.push(`Emissions: ${rel.emissionsTotal} ${rel.emissionsUnit || 'kgCO2e'}`)
  }

  if (rel.materialLossPercent && rel.materialLossPercent > 0) {
    parts.push(`Loss: ${rel.materialLossPercent}%`)
  }

  return parts.join('<br/>')
}

function getFlowCategoryEmoji(category: FlowCategory): string {
  switch (category) {
    case 'RECYCLING': return '♻️'
    case 'REUSE': return '🔄'
    case 'DOWNCYCLING': return '⬇️'
    case 'CIRCULAR': return '🔄'
    case 'WASTE_FLOW': return '🗑️'
    default: return '→'
  }
}
