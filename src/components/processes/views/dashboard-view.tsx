'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  RotateCcw,
  Rows3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { CountList } from '../count-list'
import type {
  EnhancedMaterialObject,
  EnhancedMaterialRelationship,
} from '@/types'

import { PROCESS_CATEGORY_COLORS, LIFECYCLE_STAGE_COLORS } from '../constants'

const EMPTY_MATERIALS: EnhancedMaterialObject[] = []
const EMPTY_RELATIONSHIPS: EnhancedMaterialRelationship[] = []

interface DashboardViewProps {
  materials?: EnhancedMaterialObject[]
  relationships?: EnhancedMaterialRelationship[]
  onCreateProcess?: () => void
}

export function DashboardView({
  materials = EMPTY_MATERIALS,
  relationships = EMPTY_RELATIONSHIPS,
  onCreateProcess = () => {},
}: DashboardViewProps) {
  const t = useTranslations()
  const dashboardData = useMemo(() => {
    // Calculate KPIs
    const totalFlows = relationships.length
    const circularFlows = relationships.filter(
      (rel) =>
        rel.flowCategory === 'RECYCLING' ||
        rel.flowCategory === 'REUSE' ||
        rel.flowCategory === 'CIRCULAR' ||
        rel.inputMaterial?.lifecycleStage === 'SECONDARY_INPUT' ||
        rel.outputMaterial?.lifecycleStage === 'SECONDARY_INPUT'
    ).length
    const circularityRate =
      totalFlows > 0 ? Math.round((circularFlows / totalFlows) * 100) : 0

    // Material insights - calculated from filtered relationships
    const uniqueMaterialUuids = new Set<string>()
    relationships.forEach((rel) => {
      uniqueMaterialUuids.add(rel.subject.uuid)
      uniqueMaterialUuids.add(rel.object.uuid)
    })
    const totalMaterials = uniqueMaterialUuids.size

    // Process category breakdown
    const processCategoryStats = relationships.reduce(
      (acc, rel) => {
        const category = rel.processTypeCode || 'UNKNOWN'
        acc[category] = (acc[category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Lifecycle stage distribution - from materials (which have fallback logic)
    const lifecycleStats = materials.reduce(
      (acc, mat) => {
        if (mat.lifecycleStage) {
          acc[mat.lifecycleStage] = (acc[mat.lifecycleStage] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>
    )

    const reusedComponents = lifecycleStats['REUSED_COMPONENT'] || 0

    // Environmental impact summary
    const environmentalImpact = relationships.reduce(
      (acc, rel) => {
        if (rel.emissionsTotal) acc.totalEmissions += rel.emissionsTotal
        if (rel.materialLossPercent) {
          acc.totalMaterialLoss += rel.materialLossPercent
          acc.materialLossCount += 1
        }
        if (rel.qualityChangeCode === 'UPCYCLED') acc.upcycledProcesses += 1
        if (rel.qualityChangeCode === 'DOWNCYCLED') acc.downcycledProcesses += 1
        return acc
      },
      {
        totalEmissions: 0,
        totalMaterialLoss: 0,
        materialLossCount: 0,
        upcycledProcesses: 0,
        downcycledProcesses: 0,
      }
    )

    // Calculate average material loss percentage
    const averageMaterialLoss =
      environmentalImpact.materialLossCount > 0
        ? environmentalImpact.totalMaterialLoss /
          environmentalImpact.materialLossCount
        : 0

    return {
      kpis: {
        totalFlows,
        circularFlows,
        circularityRate,
        totalMaterials,
        reusedComponents,
      },
      breakdowns: {
        processCategories: processCategoryStats,
        lifecycleStages: lifecycleStats,
        processCategoriesTotal: Object.keys(processCategoryStats).length,
        lifecycleStagesTotal: Object.keys(lifecycleStats).length,
      },
      environmental: {
        ...environmentalImpact,
        averageMaterialLoss,
      },
    }
  }, [materials, relationships])

  if (materials.length === 0 && relationships.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Factory className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('processes.dashboard.noDataTitle')}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t('processes.dashboard.noDataDescription')}
          </p>
          <button
            onClick={onCreateProcess}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {t('processes.dashboard.createFirstProcess')}
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
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {dashboardData.kpis.totalFlows}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('processes.dashboard.totalFlows')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circular Flows */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Recycle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {dashboardData.kpis.circularFlows}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('processes.dashboard.circularFlows')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circularity Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {dashboardData.kpis.circularityRate}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('processes.dashboard.circularityRate')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reused Components */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                <RefreshCw className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {dashboardData.kpis.reusedComponents}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('processes.dashboard.reusedComponents')}
                </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Rows3 className="h-5 w-5" />
                {t('processes.dashboard.processCategories')}
              </CardTitle>
              {dashboardData.breakdowns.processCategoriesTotal > 5 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {t('processes.dashboard.topCount', {
                    count: dashboardData.breakdowns.processCategoriesTotal,
                  })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <CountList
              data={dashboardData.breakdowns.processCategories}
              maxItems={4}
              emptyMessage={t('processes.dashboard.noProcessCategoryData')}
              colorPalette={PROCESS_CATEGORY_COLORS}
            />
          </CardContent>
        </Card>

        {/* Lifecycle Stages List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {t('processes.dashboard.lifecycleStages')}
              </CardTitle>
              {dashboardData.breakdowns.lifecycleStagesTotal > 5 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {t('processes.dashboard.topCount', {
                    count: dashboardData.breakdowns.lifecycleStagesTotal,
                  })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <CountList
              data={dashboardData.breakdowns.lifecycleStages}
              maxItems={4}
              emptyMessage={t('processes.dashboard.noLifecycleData')}
              colorPalette={LIFECYCLE_STAGE_COLORS}
            />
          </CardContent>
        </Card>
      </div>

      {/* Environmental Impact Section - Improved */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5" />
            {t('processes.dashboard.environmentalImpact')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CO₂ Emissions */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                  <Leaf className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-green-700 dark:text-green-300">
                      {dashboardData.environmental.totalEmissions.toFixed(1)}
                    </span>
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      kg CO₂
                    </span>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    {t('processes.dashboard.totalEmissions')}
                  </div>
                </div>
              </div>
            </div>

            {/* Material Loss */}
            <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-lg border border-orange-100 dark:border-orange-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-orange-700 dark:text-orange-300">
                      {dashboardData.environmental.averageMaterialLoss.toFixed(
                        1
                      )}
                    </span>
                    <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                      %
                    </span>
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    {t('processes.dashboard.avgMaterialLoss')}
                  </div>
                </div>
              </div>
            </div>

            {/* Upcycled Processes */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-blue-700 dark:text-blue-300">
                      {dashboardData.environmental.upcycledProcesses}
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {t('processes.dashboard.processesUnit')}
                    </span>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    {t('processes.dashboard.upcycled')}
                  </div>
                </div>
              </div>
            </div>

            {/* Downcycled Processes */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 rounded-lg border border-red-100 dark:border-red-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-red-700 dark:text-red-300">
                      {dashboardData.environmental.downcycledProcesses}
                    </span>
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                      {t('processes.dashboard.processesUnit')}
                    </span>
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {t('processes.dashboard.downcycled')}
                  </div>
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
            {t('processes.dashboard.materialsTitle', {
              count: materials.length,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6  gap-3 max-h-64 overflow-y-auto">
            {materials.map((material) => {
              const materialFlowCount = relationships.filter(
                (rel) =>
                  rel.subject.uuid === material.uuid ||
                  rel.object.uuid === material.uuid
              ).length

              return (
                <div
                  key={material.uuid}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate text-foreground">
                      {material.name ||
                        t('processes.dashboard.unnamedMaterial')}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full ml-1 bg-muted text-muted-foreground">
                      {materialFlowCount}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {material.lifecycleStage
                      ?.replace(/_/g, ' ')
                      .toLowerCase() || t('processes.dashboard.noStage')}
                  </div>
                </div>
              )
            })}
          </div>
          {materials.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>{t('processes.dashboard.noMaterials')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
