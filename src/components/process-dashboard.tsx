'use client'

import { useMemo } from 'react'
import {
  ArrowLeftRight,
  Recycle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Package,
  Factory,
  Leaf,
  AlertTriangle,
  PieChart as PieChartIcon,
  ListIcon,
  RotateCcw,
  Rows3
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { CountList } from '@/components/charts/count-list'
import type {
  EnhancedMaterialObject,
  EnhancedMaterialRelationship
} from '@/types'

// Color palettes for pie charts
const PROCESS_CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
]

const LIFECYCLE_STAGE_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
]

interface ProcessDashboardProps {
  materials?: EnhancedMaterialObject[]
  relationships?: EnhancedMaterialRelationship[]
  onCreateProcess?: () => void
}

export function ProcessDashboard({
  materials = [],
  relationships = [],
  onCreateProcess = () => { }
}: ProcessDashboardProps) {
  const dashboardData = useMemo(() => {
    // Calculate KPIs
    const totalFlows = relationships.length
    const circularFlows = relationships.filter(rel =>
      rel.flowCategory === 'RECYCLING' ||
      rel.flowCategory === 'REUSE' ||
      rel.flowCategory === 'CIRCULAR' ||
      rel.inputMaterial?.lifecycleStage === 'SECONDARY_INPUT' ||
      rel.outputMaterial?.lifecycleStage === 'SECONDARY_INPUT'
    ).length
    const circularityRate = totalFlows > 0 ? Math.round((circularFlows / totalFlows) * 100) : 0

    // Material insights - calculated from filtered relationships
    const uniqueMaterialUuids = new Set<string>()
    relationships.forEach(rel => {
      uniqueMaterialUuids.add(rel.subject.uuid)
      uniqueMaterialUuids.add(rel.object.uuid)
    })
    const totalMaterials = uniqueMaterialUuids.size

    // Process category breakdown
    const processCategoryStats = relationships.reduce((acc, rel) => {
      const category = rel.processTypeCode || 'UNKNOWN'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Lifecycle stage distribution - from filtered relationships
    const lifecycleStats = relationships.reduce((acc, rel) => {
      // Count input material lifecycle stages
      if (rel.inputMaterial?.lifecycleStage) {
        const stage = rel.inputMaterial.lifecycleStage
        acc[stage] = (acc[stage] || 0) + 1
      }
      // Count output material lifecycle stages
      if (rel.outputMaterial?.lifecycleStage) {
        const stage = rel.outputMaterial.lifecycleStage
        acc[stage] = (acc[stage] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const reusedComponents = lifecycleStats['REUSED_COMPONENT'] || 0

    // Environmental impact summary
    const environmentalImpact = relationships.reduce((acc, rel) => {
      if (rel.emissionsTotal) acc.totalEmissions += rel.emissionsTotal
      if (rel.materialLossPercent) {
        acc.totalMaterialLoss += rel.materialLossPercent
        acc.materialLossCount += 1
      }
      if (rel.qualityChangeCode === 'UP') acc.upcycledProcesses += 1
      if (rel.qualityChangeCode === 'DOWN') acc.downcycledProcesses += 1
      return acc
    }, {
      totalEmissions: 0,
      totalMaterialLoss: 0,
      materialLossCount: 0,
      upcycledProcesses: 0,
      downcycledProcesses: 0
    })

    // Calculate average material loss percentage
    const averageMaterialLoss = environmentalImpact.materialLossCount > 0 
      ? environmentalImpact.totalMaterialLoss / environmentalImpact.materialLossCount 
      : 0

    return {
      kpis: {
        totalFlows,
        circularFlows,
        circularityRate,
        totalMaterials,
        reusedComponents
      },
      breakdowns: {
        processCategories: processCategoryStats,
        lifecycleStages: lifecycleStats
      },
      environmental: {
        ...environmentalImpact,
        averageMaterialLoss
      }
    }
  }, [materials, relationships])


  if (materials.length === 0 && relationships.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Factory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Process Data</h3>
          <p className="text-gray-600 mb-6">
            Start by creating your first material flow process to see insights and analytics.
          </p>
          <button
            onClick={onCreateProcess}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Create First Process
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards - 4 per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Flows */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{dashboardData.kpis.totalFlows}</div>
                <div className="text-xs text-muted-foreground">Total Flows</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circular Flows */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Recycle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{dashboardData.kpis.circularFlows}</div>
                <div className="text-xs text-muted-foreground">Circular Flows</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circularity Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{dashboardData.kpis.circularityRate}%</div>
                <div className="text-xs text-muted-foreground">Circularity Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reused Components */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100">
                <RefreshCw className="h-4 w-4 text-cyan-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{dashboardData.kpis.reusedComponents}</div>
                <div className="text-xs text-muted-foreground">Reused Components</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

       {/* Charts Section - Count Lists */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Process Categories List */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="flex items-center gap-2">
               <Rows3 className="h-5 w-5" />
               Process Categories
             </CardTitle>
           </CardHeader>
           <CardContent className="p-4">
             <CountList
               data={dashboardData.breakdowns.processCategories}
               maxItems={5}
               emptyMessage="No process category data"
               colorPalette={PROCESS_CATEGORY_COLORS}
               showTopIndicator={true}
             />
           </CardContent>
         </Card>

         {/* Lifecycle Stages List */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="flex items-center gap-2">
               <RotateCcw className="h-5 w-5" />
               Lifecycle Stages
             </CardTitle>
           </CardHeader>
           <CardContent className="p-4">
             <CountList
               data={dashboardData.breakdowns.lifecycleStages}
               maxItems={5}
               emptyMessage="No lifecycle stage data"
               colorPalette={LIFECYCLE_STAGE_COLORS}
               showTopIndicator={true}
             />
           </CardContent>
         </Card>
       </div>

      {/* Environmental Impact Section - Improved */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5" />
            Environmental Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CO₂ Emissions */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Leaf className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-green-700">
                      {dashboardData.environmental.totalEmissions.toFixed(1)}
                    </span>
                    <span className="text-sm text-green-600 font-medium">kg CO₂</span>
                  </div>
                  <div className="text-xs text-green-600">Total Emissions</div>
                </div>
              </div>
            </div>

            {/* Material Loss */}
            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-orange-700">
                      {dashboardData.environmental.averageMaterialLoss.toFixed(1)}
                    </span>
                    <span className="text-sm text-orange-600 font-medium">%</span>
                  </div>
                  <div className="text-xs text-orange-600">Avg Material Loss</div>
                </div>
              </div>
            </div>

            {/* Upcycled Processes */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-blue-700">
                      {dashboardData.environmental.upcycledProcesses}
                    </span>
                    <span className="text-sm text-blue-600 font-medium">processes</span>
                  </div>
                  <div className="text-xs text-blue-600">Upcycled</div>
                </div>
              </div>
            </div>

            {/* Downcycled Processes */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-red-700">
                      {dashboardData.environmental.downcycledProcesses}
                    </span>
                    <span className="text-sm text-red-600 font-medium">processes</span>
                  </div>
                  <div className="text-xs text-red-600">Downcycled</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materials Display - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materials ({materials.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-64 overflow-y-auto">
            {materials.map((material) => {
              const materialFlowCount = relationships.filter(rel =>
                rel.subject.uuid === material.uuid || rel.object.uuid === material.uuid
              ).length

              return (
                <div
                  key={material.uuid}
                  className="p-3 rounded-lg border border-gray-200 bg-white"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate text-gray-900">
                      {material.name || 'Unnamed Material'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full ml-1 bg-gray-100 text-gray-600">
                      {materialFlowCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {material.lifecycleStage?.replace(/_/g, ' ').toLowerCase() || 'No stage'}
                  </div>
                </div>
              )
            })}
          </div>
          {materials.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No materials available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
