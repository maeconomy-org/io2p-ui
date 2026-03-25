'use client'

import { useMemo, memo } from 'react'
import { useTheme } from 'next-themes'
import ReactECharts from 'echarts-for-react'
import type {
  EnhancedMaterialObject,
  EnhancedMaterialRelationship,
  FlowCategory,
} from '@/types'
import { toCapitalize } from '@/lib'
import { detectAndRemoveCycles } from '../utils'

interface SankeyDiagramProps {
  materials?: EnhancedMaterialObject[]
  relationships?: EnhancedMaterialRelationship[]
  selectedRelationship?: EnhancedMaterialRelationship | null
  onLinkSelect?: (relationship: EnhancedMaterialRelationship) => void
  onNodeClick?: (nodeUuid: string, nodeName: string) => void
  className?: string
}

export const SankeyDiagram = memo(function SankeyDiagram({
  materials = [],
  relationships = [],
  selectedRelationship = null,
  onLinkSelect = () => {},
  onNodeClick,
  className = '',
}: SankeyDiagramProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { chartOptions, cycleInfo } = useMemo(() => {
    if (!materials || materials.length === 0) {
      return { chartOptions: null, recyclingInfo: null, cycleInfo: null }
    }

    // Compute layout using metadata-driven approach
    const { nodes, links, recyclingFlows, cycleInfo, stats } =
      computeEnhancedLayout(materials, relationships)

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

      // Subtle border styling — only special nodes get a visible border
      let borderColor = 'transparent'
      let borderWidth = 0
      let borderType: 'solid' | 'dashed' = 'solid'

      if (node.isReusedComponent) {
        borderColor = '#7DD3FC'
        borderWidth = 2
        borderType = 'dashed'
      } else if (node.isRecyclingMaterial) {
        borderColor = '#6EE7B7'
        borderWidth = 2
        borderType = 'dashed'
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
          color: isDark ? '#E5E7EB' : '#1F2937',
        },
        itemStyle: {
          color: node.color,
          borderColor,
          borderWidth,
          borderType,
          opacity: 1,
        },
        tooltip: {
          formatter: createNodeTooltip(node, isRecyclingRelated),
        },
        original: node,
        isRecyclingRelated,
      }
    })

    // Create enhanced links with metadata-driven styling and impact data
    const chartLinks = links.map((rel) => {
      const isSelected =
        selectedRelationship?.subject.uuid === rel.subject.uuid &&
        selectedRelationship?.object.uuid === rel.object.uuid &&
        selectedRelationship?.processName === rel.processName &&
        selectedRelationship?.inputMaterial?.quantity ===
          rel.inputMaterial?.quantity &&
        selectedRelationship?.inputMaterial?.unit === rel.inputMaterial?.unit

      const inputNode = nodes.find((n) => n.uuid === rel.subject.uuid)
      const outputNode = nodes.find((n) => n.uuid === rel.object.uuid)

      const { overrideColor, width, curveness, lineType } = getFlowStyling(
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
          // Only override color for selected or special-category flows;
          // otherwise leave undefined so the series-level 'source' color mode applies
          ...(overrideColor ? { color: overrideColor } : {}),
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
        backgroundColor: isDark
          ? 'rgba(30, 41, 59, 0.95)'
          : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#334155' : '#E5E7EB',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
          color: isDark ? '#E2E8F0' : '#374151',
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
            color: isDark ? '#D1D5DB' : '#374151',
          },
          lineStyle: {
            color: 'source',
            curveness: 0.5,
            opacity: 0.35,
          },
        },
      ],
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    }

    return {
      chartOptions: options,
      recyclingInfo: { recyclingFlows, stats },
      cycleInfo,
    }
  }, [materials, relationships, selectedRelationship, isDark])

  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full pt-6 ${className}`}>
      {/* Chart */}
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
            } else if (
              params.dataType === 'node' &&
              params.data?.original &&
              onNodeClick
            ) {
              onNodeClick(params.data.original.uuid, params.data.original.name)
            }
          },
        }}
        opts={{ renderer: 'canvas' }}
      />

      {/* Simplified Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">Flow Types:</span>
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-1 rounded-sm"
              style={{ backgroundColor: '#C8E6C3' }}
            ></div>
            <span>Recycling</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-1 rounded-sm"
              style={{ backgroundColor: '#B4CDE3' }}
            ></div>
            <span>Reuse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-1 rounded-sm"
              style={{ backgroundColor: '#CFC0E8' }}
            ></div>
            <span>Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-1 rounded-sm"
              style={{ backgroundColor: '#FFBCBA' }}
            ></div>
            <span>Waste</span>
          </div>
        </div>
        <span className="text-muted-foreground/50">•</span>
        <span>Hover for details • Click flows for more details</span>
      </div>

      {/* Compact Cycle Detection Notice */}
      {cycleInfo && cycleInfo.removedCount > 0 && (
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="text-amber-600 dark:text-amber-500">⚠</span>
            <span>
              {cycleInfo.removedCount} circular flow
              {cycleInfo.removedCount > 1 ? 's' : ''} removed
            </span>
            {cycleInfo.cycles.length > 0 && (
              <details className="inline">
                <summary className="cursor-pointer text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 ml-1">
                  ({cycleInfo.cycles.length} cycle
                  {cycleInfo.cycles.length > 1 ? 's' : ''})
                </summary>
                <div className="mt-1.5 ml-4 space-y-0.5 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                  {cycleInfo.cycles.slice(0, 3).map((cycle) => (
                    <div key={cycle.join('-')}>
                      {cycle.join(' → ')} → {cycle[0]}
                    </div>
                  ))}
                  {cycleInfo.cycles.length > 3 && (
                    <div className="text-amber-600/70 dark:text-amber-400/70">
                      ... and {cycleInfo.cycles.length - 3} more
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

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

  // Detect and remove cycles to ensure DAG compliance
  const { validFlows, removedFlows, cycleInfo } =
    detectAndRemoveCycles(standardFlows)

  // Calculate statistics
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
      ? Math.round((recyclingQuantity / totalQuantity) * 100)
      : 0

  return {
    nodes,
    links: validFlows,
    recyclingFlows,
    removedFlows,
    cycleInfo,
    stats: {
      totalFlows: relationships.length,
      recyclingFlows: recyclingFlows.length,
      recyclingRate,
      totalQuantity,
      recyclingQuantity,
      removedCycles: removedFlows.length,
    },
  }
}

/**
 * Get stage number from lifecycle metadata
 */
function getStageFromLifecycle(
  stage: string | undefined,
  fallbackType: string
): number {
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

  // Only set overrideColor for selected or special-category flows.
  // Standard flows leave it undefined so the series-level color:'source' applies.
  let overrideColor: string | undefined

  if (isSelected) {
    overrideColor = '#DC2626'
  } else {
    switch (rel.flowCategory) {
      case 'RECYCLING':
        overrideColor = '#C8E6C3' // Sage green
        break
      case 'REUSE':
        overrideColor = '#B4CDE3' // Steel blue
        break
      case 'DOWNCYCLING':
        overrideColor = '#CFC0E8' // Lavender
        break
      case 'CIRCULAR':
        overrideColor = '#C8E6C3' // Sage green
        break
      case 'WASTE_FLOW':
        overrideColor = '#FFBCBA' // Salmon pink
        break
    }
  }

  // Width based on flow importance
  let width = 2
  if (isSelected) {
    width = 6
  } else if (rel.flowCategory === 'REUSE') {
    width = 4 // Thicker for reuse to highlight
  } else if (
    rel.flowCategory === 'RECYCLING' ||
    rel.flowCategory === 'CIRCULAR'
  ) {
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

  return { overrideColor, width, curveness, lineType }
}

/**
 * Get flow opacity based on metadata
 */
function getFlowOpacity(rel: EnhancedMaterialRelationship): number {
  if (
    rel.flowCategory === 'RECYCLING' ||
    rel.flowCategory === 'REUSE' ||
    rel.flowCategory === 'CIRCULAR'
  ) {
    return 0.9 // Higher opacity for circular economy flows
  }
  return 0.7
}

/**
 * Create enhanced node tooltip with lifecycle information (no quantities - those vary per relationship)
 */
function createNodeTooltip(
  node: EnhancedMaterialObject,
  isRecyclingRelated: boolean
): string {
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
  const parts = [`<strong>${rel.subject.name} → ${rel.object.name}</strong>`]

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
    parts.push(
      `<strong>🌍 Emissions: ${rel.emissionsTotal} ${rel.emissionsUnit || 'kgCO2e'}</strong>`
    )
  }

  if (rel.materialLossPercent && rel.materialLossPercent > 0) {
    parts.push(`<strong>⚠️ Material Loss: ${rel.materialLossPercent}%</strong>`)
  }

  if (rel.qualityChangeCode) {
    const qualityLabel =
      rel.qualityChangeCode === 'UPCYCLED'
        ? 'Upcycled'
        : rel.qualityChangeCode === 'DOWNCYCLED'
          ? 'Downcycled'
          : 'Same Quality'
    const qualityEmoji =
      rel.qualityChangeCode === 'UPCYCLED'
        ? '⬆️'
        : rel.qualityChangeCode === 'DOWNCYCLED'
          ? '⬇️'
          : '➡️'
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
