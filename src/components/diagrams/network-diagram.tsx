'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { MaterialObject, MaterialRelationship } from '@/types'
import { getStageColor } from '@/lib'

interface NetworkDiagramProps {
  materials?: MaterialObject[]
  relationships?: MaterialRelationship[]
  selectedRelationship?: MaterialRelationship | null
  onLinkSelect?: (relationship: MaterialRelationship) => void
  onNodeSelect?: (material: MaterialObject) => void
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

    // Create nodes with enhanced positioning
    const nodes = materials.map((material, index) => {
      const type = material.type?.toLowerCase() || ''
      const name = material.name?.toLowerCase() || ''

      // Determine category for layout
      let category = 0
      let symbolSize = 40

      if (type === 'input') {
        category = name.includes('recycled') ? 1 : 0
        symbolSize = 35
      } else if (type === 'intermediate') {
        category = 2
        symbolSize = 45
      } else if (type === 'output') {
        if (name.includes('building') || name.includes('completed')) {
          category = 3
          symbolSize = 50
        } else if (name.includes('waste') || name.includes('scrap')) {
          category = 4
          symbolSize = 35
        } else {
          category = 5 // Environmental
          symbolSize = 30
        }
      }

      const isRecyclingRelated =
        material.name.toLowerCase().includes('recycled') ||
        material.name.toLowerCase().includes('reclaimed')

      return {
        id: material.uuid,
        name: material.name,
        category: category,
        symbolSize: symbolSize,
        value: symbolSize,
        itemStyle: {
          color: material.color || getStageColor(category),
          borderColor: isRecyclingRelated ? '#10B981' : '#FFFFFF',
          borderWidth: isRecyclingRelated ? 3 : 1,
          borderType: isRecyclingRelated ? 'dashed' : 'solid',
        },
        label: {
          show: true,
          position: 'bottom',
          fontSize: 10,
          fontWeight: 'bold',
          color: '#374151',
        },
        emphasis: {
          focus: 'adjacency',
          itemStyle: {
            borderWidth: 3,
          },
        },
        original: material,
        isRecyclingRelated,
      }
    })

    // Create links with enhanced styling
    const links = relationships.map((rel) => {
      const isSelected =
        selectedRelationship?.subject.uuid === rel.subject.uuid &&
        selectedRelationship?.object.uuid === rel.object.uuid &&
        selectedRelationship?.processName === rel.processName

      const isRecyclingProcess =
        rel.processName?.toLowerCase().includes('recycl') ||
        rel.processName?.toLowerCase().includes('reclaim') ||
        rel.subject.name.toLowerCase().includes('waste') ||
        rel.subject.name.toLowerCase().includes('scrap') ||
        rel.object.name.toLowerCase().includes('recycled')

      return {
        source: rel.subject.uuid,
        target: rel.object.uuid,
        value: rel.quantity || 1,
        lineStyle: {
          color: isSelected
            ? '#DC2626'
            : isRecyclingProcess
              ? '#10B981'
              : '#64748B',
          width: isSelected ? 4 : isRecyclingProcess ? 3 : 2,
          opacity: isRecyclingProcess ? 0.9 : 0.7,
          type: isRecyclingProcess ? 'dashed' : 'solid',
          curveness: isRecyclingProcess ? 0.3 : 0.2,
        },
        emphasis: {
          lineStyle: {
            width: 5,
            opacity: 1,
          },
        },
        label: {
          show: false,
          formatter: '{c}',
        },
        relationship: rel,
        isRecyclingProcess,
      }
    })

    // Calculate recycling statistics
    const recyclingFlows = relationships.filter(
      (rel) =>
        rel.processName?.toLowerCase().includes('recycl') ||
        rel.subject.name.toLowerCase().includes('waste') ||
        rel.object.name.toLowerCase().includes('recycled')
    )

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

    const options = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        textStyle: {
          fontSize: 12,
        },
        formatter: function (params: any) {
          if (params.dataType === 'node') {
            const node = params.data.original
            return `<strong>${node.name}</strong><br/>
                   Type: ${node.type}<br/>
                   Category: ${node.category || 'Unknown'}<br/>
                   ${params.data.isRecyclingRelated ? '♻️ Circular Economy Material<br/>' : ''}
                   UUID: ${node.uuid.substring(0, 8)}...`
          } else if (params.dataType === 'edge') {
            const rel = params.data.relationship
            return `<strong>${rel.subject.name} → ${rel.object.name}</strong><br/>
                   ${params.data.isRecyclingProcess ? '♻️ Circular Process<br/>' : ''}
                   Quantity: ${rel.quantity?.toLocaleString() || 0} ${rel.unit || ''}<br/>
                   ${rel.processName ? `Process: ${rel.processName}<br/>` : ''}
                   Predicate: ${rel.predicate}`
          }
          return params.name
        },
      },
      // legend: {
      //   data: [
      //     'Primary Inputs',
      //     'Recycled Inputs',
      //     'Processing',
      //     'Products',
      //     'Waste Streams',
      //     'Environmental',
      //   ],
      //   bottom: 10,
      //   textStyle: {
      //     fontSize: 12,
      //   },
      // },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links: links,
          categories: [
            { name: 'Primary Inputs', itemStyle: { color: '#1E40AF' } },
            { name: 'Recycled Inputs', itemStyle: { color: '#3B82F6' } },
            { name: 'Processing', itemStyle: { color: '#8B5CF6' } },
            { name: 'Products', itemStyle: { color: '#10B981' } },
            { name: 'Waste Streams', itemStyle: { color: '#F59E0B' } },
            { name: 'Environmental', itemStyle: { color: '#DC2626' } },
          ],
          force: {
            repulsion: 800,
            gravity: 0.1,
            edgeLength: 150,
            layoutAnimation: true,
          },
          roam: true,
          nodeScaleRatio: 0.6,
          draggable: true,
          focusNodeAdjacency: true,
          lineStyle: {
            color: 'source',
            curveness: 0.2,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 5,
            },
          },
          animation: true,
          animationDuration: 2000,
          animationEasing: 'cubicOut',
        },
      ],
    }

    return {
      chartOptions: options,
      stats: {
        totalFlows: relationships.length,
        recyclingFlows: recyclingFlows.length,
        recyclingRate,
        totalMaterials: materials.length,
      },
    }
  }, [materials, relationships, selectedRelationship])

  // If no chart options, don't render anything (parent handles loading/empty states)
  if (!chartOptions) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
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
            } else if (
              params.dataType === 'node' &&
              params.data?.original &&
              onNodeSelect
            ) {
              onNodeSelect(params.data.original)
            }
          },
        }}
        opts={{ renderer: 'canvas' }}
      />

      {/* Usage Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-xs text-blue-700">
          <strong>Interaction:</strong> Drag nodes to reposition • Zoom with
          mouse wheel • Click links for details • All circular flows preserved
          for complete analysis
        </div>
      </div>
    </div>
  )
}
