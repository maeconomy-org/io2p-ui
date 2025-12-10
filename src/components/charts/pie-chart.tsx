'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

interface PieChartData {
  name: string
  value: number
}

interface PieChartProps {
  data: Record<string, number>
  title?: string
  colors?: string[]
  height?: number
  emptyMessage?: string
}

// Default color palette
const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280', // gray
]

export function PieChart({
  data,
  title,
  colors = DEFAULT_COLORS,
  height = 200,
  emptyMessage = 'No data available'
}: PieChartProps) {
  const chartOptions = useMemo(() => {
    const chartData: PieChartData[] = Object.entries(data)
      .sort(([,a], [,b]) => b - a)
      .map(([name, value], index) => ({
        name: name.toLowerCase().replace(/_/g, ' '),
        value,
        itemStyle: { color: colors[index % colors.length] }
      }))

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { fontSize: 11 }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          padAngle: 2,
          itemStyle: {
            borderRadius: 4
          },
          label: {
            position: 'center',
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          data: chartData
        }
      ]
    }
  }, [data, colors])

  const hasData = Object.keys(data).length > 0

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      {hasData ? (
        <ReactECharts 
          option={chartOptions} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          {emptyMessage}
        </div>
      )}
    </div>
  )
}
