'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Card, CardContent } from '@/components/ui'
import { ArrowLeftRight, Recycle, TrendingUp, RefreshCw } from 'lucide-react'
import type { 
  EnhancedMaterialObject, 
  EnhancedMaterialRelationship,
  FlowCategory 
} from '@/types'
import { formatUUID, toCapitalize } from '@/lib'

interface SankeyDiagramProps {
  materials?: EnhancedMaterialObject[]
  relationships?: EnhancedMaterialRelationship[]
  selectedRelationship?: EnhancedMaterialRelationship | null
  onLinkSelect?: (relationship: EnhancedMaterialRelationship) => void
  className?: string
}

export function SankeyDiagram({
  materials = [],
  relationships = [],
  selectedRelationship = null,
  onLinkSelect = () => {},
  className = '',
}: SankeyDiagramProps) {
  const { chartOptions, recyclingInfo } = useMemo(() => {
    if (!materials || materials.length === 0) {
      return { chartOptions: null, recyclingInfo: null }
    }

    // Compute layout using metadata-driven approach
    const { nodes, links, recyclingFlows, stats } = computeEnhancedLayout(materials, relationships)

    // Identify materials involved in recycling/reuse
    const recyclingMaterialIds = new Set<string>()
    recyclingFlows.forEach((rel) => {
      recyclingMaterialIds.add(rel.subject.uuid)
      recyclingMaterialIds.add(rel.object.uuid)
    })

    // Create ECharts nodes with enhanced metadata visualization
    const chartNodes = nodes.map((node) => {
      const isRecyclingRelated = 
        recyclingMaterialIds.has(node.uuid) ||
        !!node.isRecyclingMaterial ||
        !!node.isReusedComponent

      // Enhanced border styling for different material types
      let borderColor = '#FFFFFF'
      let borderWidth = 1
      let borderType: 'solid' | 'dashed' = 'solid'

      if (node.isReusedComponent) {
        borderColor = '#06B6D4' // Cyan for reused components
        borderWidth = 3
        borderType = 'dashed'
      } else if (node.isRecyclingMaterial) {
        borderColor = '#10B981' // Green for recycled materials
        borderWidth = 2
        borderType = 'dashed'
      } else if (isRecyclingRelated) {
        borderColor = '#059669' // Dark green for other recycling-related
        borderWidth = 2
      }

      return {
        name: node.uuid,
        value: node.uuid,
        label: {
          show: true,
          formatter: node.name || node.uuid,
          position: 'right',
          fontSize: 11,
          fontWeight: 'bold',
          color: '#1F2937',
        },
        itemStyle: {
          color: node.color,
          borderColor,
          borderWidth,
          borderType,
          opacity: 0.85,
        },
        tooltip: {
          formatter: createNodeTooltip(node, isRecyclingRelated),
        },
        original: node,
        isRecyclingRelated,
      }
    })

    // Create enhanced links with metadata-driven styling and impact data
    const chartLinks = links.map((rel, index) => {
      const isSelected =
        selectedRelationship?.subject.uuid === rel.subject.uuid &&
        selectedRelationship?.object.uuid === rel.object.uuid &&
        selectedRelationship?.processName === rel.processName &&
        selectedRelationship?.inputMaterial?.quantity === rel.inputMaterial?.quantity &&
        selectedRelationship?.inputMaterial?.unit === rel.inputMaterial?.unit

      const inputNode = nodes.find((n) => n.uuid === rel.subject.uuid)
      const outputNode = nodes.find((n) => n.uuid === rel.object.uuid)

      // Determine flow type and styling based on metadata
      const { color, width, curveness, lineType } = getFlowStyling(
        rel, 
        inputNode?.layer || 0, 
        outputNode?.layer || 0, 
        isSelected
      )

      return {
        source: rel.subject.uuid,
        target: rel.object.uuid,
        value: rel.inputMaterial?.quantity || 1,
        lineStyle: {
          color,
          width,
          opacity: getFlowOpacity(rel),
          curveness,
          type: lineType,
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

    const options = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
        },
        confine: true,
      },
      series: [
        {
          type: 'sankey',
          data: chartNodes,
          links: chartLinks,
          nodeWidth: 30,
          nodeGap: 15,
          nodeAlign: 'left',
          orient: 'horizontal',
          layoutIterations: 64,
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              opacity: 1,
            },
          },
          blur: {
            lineStyle: {
              opacity: 0.1,
            },
            itemStyle: {
              opacity: 0.3,
            },
          },
          label: {
            fontSize: 11,
            fontWeight: 'normal',
            color: '#374151',
          },
          lineStyle: {
            curveness: 0.5,
          },
        },
      ],
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    }

    return {
      chartOptions: options,
      recyclingInfo: { recyclingFlows, stats },
    }
  }, [materials, relationships, selectedRelationship])

  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Statistics */}
      {recyclingInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{recyclingInfo.stats.totalFlows || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Flows</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Recycle className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{recyclingInfo.stats.recyclingFlows || 0}</div>
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
                  <div className="text-2xl font-semibold">{recyclingInfo.stats.recyclingRate || 0}%</div>
                  <div className="text-xs text-muted-foreground">Circularity Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100">
                  <RefreshCw className="h-4 w-4 text-cyan-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{materials.filter((m) => m.isReusedComponent).length}</div>
                  <div className="text-xs text-muted-foreground">Reused Components</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardContent className="p-0">
          <ReactECharts
            option={chartOptions}
            style={{ height: '600px', width: '100%' }}
            onEvents={{
              click: (params: any) => {
                if (
                  params.dataType === 'edge' &&
                  params.data?.relationship &&
                  onLinkSelect
                ) {
                  onLinkSelect(params.data.relationship)
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
        <span>Click flows for details • Scroll to zoom</span>
      </div>
    </div>
  )
}

/**
 * Compute enhanced layout using metadata instead of name-based heuristics
 */
function computeEnhancedLayout(
  materials: EnhancedMaterialObject[],
  relationships: EnhancedMaterialRelationship[]
) {
  // Assign stage levels based on lifecycle metadata
  const nodes = materials.map((material) => ({
    ...material,
    layer: getStageFromLifecycle(material.lifecycleStage, material.type),
    x: getStageFromLifecycle(material.lifecycleStage, material.type),
  }))

  // Separate flows by category
  const recyclingFlows: EnhancedMaterialRelationship[] = []
  const standardFlows: EnhancedMaterialRelationship[] = []

  relationships.forEach((rel) => {
    const isCircularFlow = 
      rel.flowCategory === 'RECYCLING' ||
      rel.flowCategory === 'CIRCULAR' ||
      rel.flowCategory === 'REUSE' ||
      rel.flowCategory === 'DOWNCYCLING' ||
      rel.isCircular

    if (isCircularFlow) {
      recyclingFlows.push(rel)
    }
    standardFlows.push(rel) // Include all flows in main diagram
  })

  // Calculate statistics
  const totalQuantity = relationships.reduce((sum, rel) => sum + (rel.quantity || 0), 0)
  const recyclingQuantity = recyclingFlows.reduce((sum, rel) => sum + (rel.quantity || 0), 0)
  const recyclingRate = totalQuantity > 0 ? Math.round((recyclingQuantity / totalQuantity) * 100) : 0

  return {
    nodes,
    links: standardFlows,
    recyclingFlows,
    stats: {
      totalFlows: relationships.length,
      recyclingFlows: recyclingFlows.length,
      recyclingRate,
      totalQuantity,
      recyclingQuantity,
    },
  }
}

/**
 * Get stage number from lifecycle metadata
 */
function getStageFromLifecycle(stage: string | undefined, fallbackType: string): number {
  switch (stage) {
    case 'PRIMARY_INPUT':
      return 0.0
    case 'SECONDARY_INPUT':
      return 0.2
    case 'REUSED_COMPONENT':
      return 0.8
    case 'PROCESSING':
      return 1.5
    case 'COMPONENT':
      return 3.0
    case 'PRODUCT':
      return 3.5
    case 'USE_PHASE':
      return 3.7
    case 'WASTE':
      return 4.2
    case 'DISPOSAL':
      return 4.8
    default:
      // Fallback based on graph role
      switch (fallbackType) {
        case 'input':
          return 0.0
        case 'intermediate':
          return 2.0
        case 'output':
          return 3.5
        default:
          return 2.0
      }
  }
}

/**
 * Get flow styling based on metadata instead of name heuristics
 */
function getFlowStyling(
  rel: EnhancedMaterialRelationship,
  inputStage: number,
  outputStage: number,
  isSelected: boolean
) {
  const isBackwardFlow = inputStage > outputStage + 0.5

  // Color based on flow category
  let color = '#64748B' // Default gray
  if (isSelected) {
    color = '#DC2626' // Red for selected
  } else {
    switch (rel.flowCategory) {
      case 'RECYCLING':
        color = isBackwardFlow ? '#059669' : '#10B981' // Dark/light green
        break
      case 'REUSE':
        color = '#06B6D4' // Cyan for direct reuse
        break
      case 'DOWNCYCLING':
        color = '#3B82F6' // Blue for downcycling
        break
      case 'CIRCULAR':
        color = '#047857' // Very dark green for circular
        break
      case 'WASTE_FLOW':
        color = '#F59E0B' // Amber for waste
        break
    }
  }

  // Width based on flow importance
  let width = 2
  if (isSelected) {
    width = 6
  } else if (rel.flowCategory === 'REUSE') {
    width = 4 // Thicker for reuse to highlight
  } else if (rel.flowCategory === 'RECYCLING' || rel.flowCategory === 'CIRCULAR') {
    width = 3
  }

  // Curveness based on flow type
  let curveness = 0.3
  if (isBackwardFlow) {
    curveness = 0.9 // High curve for backward flows
  } else if (rel.flowCategory === 'CIRCULAR') {
    curveness = 0.7
  } else if (rel.flowCategory === 'RECYCLING' || rel.flowCategory === 'REUSE') {
    curveness = 0.5
  }

  // Line type based on flow category
  let lineType: 'solid' | 'dashed' | 'dotted' = 'solid'
  if (rel.flowCategory === 'RECYCLING' || rel.flowCategory === 'REUSE') {
    lineType = 'dashed'
  } else if (isBackwardFlow) {
    lineType = 'dotted'
  }

  return { color, width, curveness, lineType }
}

/**
 * Get flow opacity based on metadata
 */
function getFlowOpacity(rel: EnhancedMaterialRelationship): number {
  if (rel.flowCategory === 'RECYCLING' || rel.flowCategory === 'REUSE' || rel.flowCategory === 'CIRCULAR') {
    return 0.9 // Higher opacity for circular economy flows
  }
  return 0.7
}

/**
 * Create enhanced node tooltip with lifecycle information (no quantities - those vary per relationship)
 */
function createNodeTooltip(node: EnhancedMaterialObject, isRecyclingRelated: boolean): string {
  const parts = [
    `<strong>${node.name}</strong>`,
    `Type: ${toCapitalize(node.type)}`,
  ]

  if (node.lifecycleStage) {
    parts.push(`Lifecycle: ${node.lifecycleStage.replace(/_/g, ' ')}`)
    
    // Derive recycling/reuse status from lifecycle stage
    if (node.lifecycleStage === 'SECONDARY_INPUT') {
      parts.push(`♻️ <strong>Recycled Material</strong>`)
    } else if (node.lifecycleStage === 'REUSED_COMPONENT') {
      parts.push(`🔄 <strong>Reused Component</strong>`)
    }
  }

  if (node.domainCategoryCode) {
    parts.push(`Category: ${node.domainCategoryCode}`)
  }

  if (isRecyclingRelated) {
    parts.push(`<em>Part of Circular Economy</em>`)
  }

  return parts.join('<br/>')
}

/**
 * Create enhanced link tooltip with process-level data only (no material quantities)
 */
function createLinkTooltip(rel: EnhancedMaterialRelationship): string {
  const parts = [
    `<strong>${rel.subject.name} → ${rel.object.name}</strong>`,
  ]

  if (rel.processName) {
    parts.push(`Process: ${rel.processName}`)
  }

  if (rel.processTypeCode) {
    parts.push(`Type: ${rel.processTypeCode.replace('_', ' ')}`)
  }

  if (rel.flowCategory) {
    const categoryLabel = rel.flowCategory.replace('_', ' ').toLowerCase()
    const emoji = getFlowCategoryEmoji(rel.flowCategory)
    parts.push(`${emoji} Flow: ${toCapitalize(categoryLabel)}`)
  }

  // Impact data section
  if (rel.emissionsTotal && rel.emissionsTotal > 0) {
    parts.push(`<strong>🌍 Emissions: ${rel.emissionsTotal} ${rel.emissionsUnit || 'kgCO2e'}</strong>`)
  }

  if (rel.materialLossPercent && rel.materialLossPercent > 0) {
    parts.push(`<strong>⚠️ Material Loss: ${rel.materialLossPercent}%</strong>`)
  }

  if (rel.qualityChangeCode) {
    const qualityLabel = rel.qualityChangeCode === 'UP' ? 'Upcycled' : 
                        rel.qualityChangeCode === 'DOWN' ? 'Downcycled' : 'Same Quality'
    const qualityEmoji = rel.qualityChangeCode === 'UP' ? '⬆️' : 
                        rel.qualityChangeCode === 'DOWN' ? '⬇️' : '➡️'
    parts.push(`${qualityEmoji} Quality: ${qualityLabel}`)
  }

  if (rel.notes) {
    parts.push(`<em>Note: ${rel.notes}</em>`)
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

