'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { MaterialObject, MaterialRelationship } from '@/types'
import {
  createLayeredLayout,
  getStageColor,
  formatUUID,
  toCapitalize,
} from '@/lib'

interface SankeyDiagramProps {
  materials?: MaterialObject[]
  relationships?: MaterialRelationship[]
  selectedRelationship?: MaterialRelationship | null
  onLinkSelect?: (relationship: MaterialRelationship) => void
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

    const { nodes, links, recyclingFlows, stats } = createLayeredLayout(
      materials,
      relationships
    )

    // Identify materials involved in recycling
    const recyclingMaterialIds = new Set<string>()
    recyclingFlows.forEach((rel) => {
      recyclingMaterialIds.add(rel.subject.uuid)
      recyclingMaterialIds.add(rel.object.uuid)
    })

    // Create ECharts nodes
    const chartNodes = nodes.map((node) => {
      const isRecyclingRelated =
        recyclingMaterialIds.has(node.uuid) ||
        node.name.toLowerCase().includes('recycled')

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
          color: node.color || getStageColor(node.layer),
          borderColor: isRecyclingRelated ? '#10B981' : '#FFFFFF',
          borderWidth: isRecyclingRelated ? 3 : 1,
          borderType: isRecyclingRelated ? 'dashed' : 'solid',
          opacity: 0.85,
        },
        // Stage: ${getStageName(node.layer)}<br/>
        // ${isRecyclingRelated ? '♻️ Circular Economy Material<br/>' : ''}
        tooltip: {
          formatter: `<strong>${node.name}</strong><br/>
                     Type: ${toCapitalize(node.type)}<br/>
                     UUID: ${formatUUID(node.uuid)}`,
        },
        original: node,
        isRecyclingRelated,
      }
    })

    // Create links with enhanced recycling and circular flow visualization
    const chartLinks = links.map((rel, index) => {
      const isSelected =
        selectedRelationship?.subject.uuid === rel.subject.uuid &&
        selectedRelationship?.object.uuid === rel.object.uuid &&
        selectedRelationship?.processName === rel.processName &&
        selectedRelationship?.quantity === rel.quantity &&
        selectedRelationship?.unit === rel.unit
      const inputNode = nodes.find((n) => n.uuid === rel.subject.uuid)
      const outputNode = nodes.find((n) => n.uuid === rel.object.uuid)

      // Enhanced recycling process detection
      const isRecyclingProcess =
        rel.processName?.toLowerCase().includes('recycl') ||
        rel.processName?.toLowerCase().includes('reclaim') ||
        rel.processName?.toLowerCase().includes('reuse') ||
        rel.subject.name.toLowerCase().includes('waste') ||
        rel.subject.name.toLowerCase().includes('scrap') ||
        rel.subject.name.toLowerCase().includes('debris') ||
        rel.object.name.toLowerCase().includes('recycled') ||
        rel.object.name.toLowerCase().includes('reclaimed')

      // Detect different types of flows
      const inputStage = inputNode?.layer || 0
      const outputStage = outputNode?.layer || 0
      const isBackwardFlow = inputStage > outputStage + 0.5 // Backward/circular flow
      const isLongSkipFlow = Math.abs(inputStage - outputStage) > 2 // Long-distance flow
      const isWithinStage = Math.abs(inputStage - outputStage) < 0.5 // Same-stage flow

      // Determine curveness based on flow type
      let curveness = 0.3 // Default
      if (isBackwardFlow) {
        curveness = 0.9 // High curve for backward flows
      } else if (isRecyclingProcess) {
        curveness = 0.6 // Medium curve for recycling
      } else if (isLongSkipFlow) {
        curveness = 0.5 // Medium curve for long flows
      } else if (isWithinStage) {
        curveness = 0.2 // Low curve for same-stage flows
      }

      // Enhanced flow styling
      const getFlowColor = () => {
        if (isSelected) return '#DC2626' // Red for selected
        if (isRecyclingProcess && isBackwardFlow) return '#059669' // Dark green for circular recycling
        if (isRecyclingProcess) return '#10B981' // Green for recycling
        if (isBackwardFlow) return '#F59E0B' // Amber for other backward flows
        return '#64748B' // Default gray
      }

      const getFlowWidth = () => {
        if (isSelected) return 6
        if (isRecyclingProcess) return 4
        if (isBackwardFlow) return 3
        return 2
      }

      return {
        source: rel.subject.uuid,
        target: rel.object.uuid,
        value: rel.quantity || 1,
        lineStyle: {
          color: getFlowColor(),
          width: getFlowWidth(),
          opacity: isRecyclingProcess || isBackwardFlow ? 0.9 : 0.7,
          curveness,
          type: isRecyclingProcess
            ? 'dashed'
            : isBackwardFlow
              ? 'dotted'
              : 'solid',
        },
        emphasis: {
          lineStyle: {
            width: getFlowWidth() + 2,
            opacity: 1,
          },
        },
        // ${isRecyclingProcess ? '♻️ Recycling/Reclaim Process<br/>' : ''}
        // ${isBackwardFlow && !isRecyclingProcess ? '🔄 Circular Flow<br/>' : ''}
        // ${isBackwardFlow && isRecyclingProcess ? '🔄♻️ Circular Recycling Flow<br/>' : ''}
        // ${isRecyclingProcess ? '<em>Part of Circular Economy</em>' : ''}`,
        tooltip: {
          formatter: `<strong>${rel.subject.name} → ${rel.predicate.replaceAll('_', ' ')} → ${rel.object.name}</strong><br/>
                     Quantity: ${rel.quantity?.toLocaleString() || 0} ${rel.unit || ''}<br/>
                     ${rel.processName ? `Process: ${rel.processName}<br/>` : ''}
                     Predicate: ${rel.predicate}`,
        },
        relationship: rel,
        isRecyclingProcess,
        isBackwardFlow,
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
        confine: true, // Keep tooltips within chart area
      },
      series: [
        {
          type: 'sankey',
          data: chartNodes,
          links: chartLinks,
          nodeWidth: 30, // Slightly wider nodes for better visibility
          nodeGap: 15, // More space between nodes
          nodeAlign: 'left',
          orient: 'horizontal',
          layoutIterations: 64, // More iterations for better layout
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              opacity: 1,
            },
          },
          blur: {
            lineStyle: {
              opacity: 0.1, // Fade non-focused links more
            },
            itemStyle: {
              opacity: 0.3, // Fade non-focused nodes
            },
          },
          label: {
            fontSize: 11,
            fontWeight: 'normal',
            color: '#374151',
          },
          lineStyle: {
            curveness: 0.5, // Default curveness, overridden per link
          },
        },
      ],
      animationDuration: 1500, // Slower animation for better perception
      animationEasing: 'cubicOut',
    }

    return {
      chartOptions: options,
      recyclingInfo: { recyclingFlows, stats },
    }
  }, [materials, relationships, selectedRelationship])

  // If no chart options, don't render anything (parent handles loading/empty states)
  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Enhanced Stats */}
      {/* <div className="mt-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {recyclingInfo?.stats.totalFlows || 0}
          </div>
          <div className="text-sm text-blue-800">Total Flows</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {recyclingInfo?.stats.recyclingFlows || 0}
          </div>
          <div className="text-sm text-green-800">Recycling Flows</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-emerald-600">
            {recyclingInfo?.stats.recyclingRate || 0}%
          </div>
          <div className="text-sm text-emerald-800">Recycling Rate</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {
              materials.filter((m) => m.name.toLowerCase().includes('recycled'))
                .length
            }
          </div>
          <div className="text-sm text-purple-800">Recycled Materials</div>
        </div>
      </div> */}

      {/* Recycling Flow Summary */}
      {/* {recyclingInfo && recyclingInfo.recyclingFlows.length > 0 && (
        <div className="mb-4 space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <h4 className="text-sm font-semibold text-green-800 mb-2">
              ♻️ Active Circular Economy Flows
            </h4>
            <div className="text-xs text-green-700 space-y-1 mb-3">
              {recyclingInfo.recyclingFlows.slice(0, 4).map((flow, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>
                    • {flow.subject.name} → {flow.object.name}
                  </span>
                  <span className="font-mono">
                    {flow.quantity} {flow.unit}
                  </span>
                </div>
              ))}
              {recyclingInfo.recyclingFlows.length > 4 && (
                <div className="text-green-600 font-medium">
                  + {recyclingInfo.recyclingFlows.length - 4} more recycling
                  flows
                </div>
              )}
            </div>
            <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
              <strong>Circular Economy Impact:</strong> Waste materials are
              processed back into production inputs, reducing dependency on
              virgin materials and minimizing environmental impact.
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <h5 className="text-xs font-semibold text-blue-800 mb-1">
              📊 Visualization Note
            </h5>
            <div className="text-xs text-blue-700">
              <strong>Sankey Limitation:</strong> Some circular flows (waste →
              recycled materials) are excluded from the diagram to maintain
              graph structure requirements. These flows are tracked in the
              statistics and relationships table.
            </div>
          </div>
        </div>
      )} */}

      {/* Chart */}
      <ReactECharts
        option={chartOptions}
        style={{ height: '700px', width: '100%' }}
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

      {/* Enhanced Legend */}
      {/* <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Circular Material Flow Legend
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              Process Stages
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#1E40AF' }}
                ></div>
                <span>Primary Inputs</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#3B82F6' }}
                ></div>
                <span>Recycled Inputs</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#8B5CF6' }}
                ></div>
                <span>Early Processing</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#EF4444' }}
                ></div>
                <span>Main Processing</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#10B981' }}
                ></div>
                <span>Products</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#F59E0B' }}
                ></div>
                <span>Waste Streams</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: '#DC2626' }}
                ></div>
                <span>Final Disposal</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              Flow Types
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-slate-500"></div>
                <span>Standard Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-green-500 border-dashed border-t border-green-500"></div>
                <span className="text-green-700 font-medium">
                  ♻️ Recycling Process
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-emerald-600 border-dashed border-t border-emerald-600"></div>
                <span className="text-emerald-700 font-medium">
                  🔄♻️ Circular Recycling
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-0.5 bg-amber-500"
                  style={{ borderTop: '1px dotted #F59E0B' }}
                ></div>
                <span className="text-amber-700 font-medium">
                  🔄 Circular Flow
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              Material Indicators
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-green-500 border-dashed rounded"></div>
                <span className="text-green-700 font-medium">
                  Circular Economy Material
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 rounded"></div>
                <span className="text-blue-700">Primary Material</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-red-500 rounded"></div>
                <span className="text-red-700">Selected Item</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  )
}
