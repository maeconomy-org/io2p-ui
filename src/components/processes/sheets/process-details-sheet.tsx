'use client'

import React from 'react'
import {
  Package,
  Leaf,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Flame,
  RefreshCw,
  FileText,
  Scale,
  ArrowDown,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ScrollArea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { MaterialRelationship } from '@/types'
import type {
  EnhancedMaterialRelationship,
  FlowCategory,
  QualityChangeCode,
} from '@/types/sankey-metadata'

interface RelationshipDetailsSheetProps {
  relationship: MaterialRelationship | EnhancedMaterialRelationship | null
  isOpen: boolean
  onClose: () => void
}

// Flow category label
const getFlowCategoryLabel = (category?: FlowCategory) => {
  switch (category) {
    case 'RECYCLING':
      return 'Recycling'
    case 'REUSE':
      return 'Reuse'
    case 'CIRCULAR':
      return 'Circular'
    case 'DOWNCYCLING':
      return 'Downcycling'
    case 'WASTE_FLOW':
      return 'Waste Flow'
    default:
      return 'Standard'
  }
}

// Quality change label and styling
const getQualityInfo = (code?: QualityChangeCode) => {
  switch (code) {
    case 'UPCYCLED':
      return {
        label: 'Upcycled',
        icon: TrendingUp,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
      }
    case 'DOWNCYCLED':
      return {
        label: 'Downcycled',
        icon: TrendingDown,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
      }
    default:
      return {
        label: 'Same Quality',
        icon: Minus,
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-800/30',
        border: 'border-slate-200 dark:border-slate-700',
      }
  }
}

const RelationshipDetailsSheet: React.FC<RelationshipDetailsSheetProps> = ({
  relationship,
  isOpen,
  onClose,
}) => {
  const t = useTranslations('processDetails')

  if (!relationship) return null

  // Type guard to check if relationship is enhanced
  const isEnhanced = (rel: any): rel is EnhancedMaterialRelationship => {
    return (
      'inputMaterial' in rel || 'outputMaterial' in rel || 'flowCategory' in rel
    )
  }

  const enhanced = isEnhanced(relationship) ? relationship : null

  // Check if we have environmental impact data
  const hasEmissions = enhanced?.emissionsTotal && enhanced.emissionsTotal > 0
  const hasLoss =
    enhanced?.materialLossPercent && enhanced.materialLossPercent > 0
  const hasQuality = enhanced?.qualityChangeCode
  const hasImpactData = hasEmissions || hasLoss || hasQuality

  const qualityInfo = getQualityInfo(enhanced?.qualityChangeCode)
  const QualityIcon = qualityInfo.icon

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col">
        {/* Standard Header */}
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl">
            {relationship.processName || t('unnamedProcess')}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {enhanced?.processTypeCode && (
              <span className="text-sm text-muted-foreground">
                {enhanced.processTypeCode}
              </span>
            )}
            {enhanced?.flowCategory && enhanced.flowCategory !== 'STANDARD' && (
              <>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {getFlowCategoryLabel(enhanced.flowCategory)}
                </div>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Impact Metrics */}
            {hasImpactData && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  {t('environmentalImpact')}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {/* Emissions */}
                  <div
                    className={cn(
                      'rounded-lg p-4 border',
                      hasEmissions
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                        : 'bg-muted/30 border-border'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Flame
                        className={cn(
                          'h-4 w-4',
                          hasEmissions
                            ? 'text-orange-500 dark:text-orange-400'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium',
                          hasEmissions
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-muted-foreground'
                        )}
                      >
                        {t('emissions')}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-xl font-bold',
                        hasEmissions
                          ? 'text-orange-900 dark:text-orange-100'
                          : 'text-muted-foreground'
                      )}
                    >
                      {hasEmissions ? enhanced?.emissionsTotal : '-'}
                    </div>
                    <div
                      className={cn(
                        'text-xs',
                        hasEmissions
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {hasEmissions
                        ? enhanced?.emissionsUnit || 'kgCO2e'
                        : t('notMeasured')}
                    </div>
                  </div>

                  {/* Material Loss */}
                  <div
                    className={cn(
                      'rounded-lg p-4 border',
                      hasLoss
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                        : 'bg-muted/30 border-border'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets
                        className={cn(
                          'h-4 w-4',
                          hasLoss
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium',
                          hasLoss
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-muted-foreground'
                        )}
                      >
                        {t('materialLoss')}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-xl font-bold',
                        hasLoss
                          ? 'text-red-900 dark:text-red-100'
                          : 'text-muted-foreground'
                      )}
                    >
                      {hasLoss ? `${enhanced?.materialLossPercent}%` : '-'}
                    </div>
                    <div
                      className={cn(
                        'text-xs',
                        hasLoss
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {hasLoss ? t('lostInProcess') : t('noLoss')}
                    </div>
                  </div>

                  {/* Quality Change */}
                  <div
                    className={cn(
                      'rounded-lg p-4 border',
                      hasQuality
                        ? cn(qualityInfo.bg, qualityInfo.border)
                        : 'bg-muted/30 border-border'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Scale
                        className={cn(
                          'h-4 w-4',
                          hasQuality
                            ? qualityInfo.color
                            : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium',
                          hasQuality
                            ? qualityInfo.color
                            : 'text-muted-foreground'
                        )}
                      >
                        {t('quality')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasQuality && (
                        <QualityIcon
                          className={cn('h-5 w-5', qualityInfo.color)}
                        />
                      )}
                      <span
                        className={cn(
                          'text-lg font-bold',
                          hasQuality
                            ? qualityInfo.color
                            : 'text-muted-foreground'
                        )}
                      >
                        {hasQuality ? qualityInfo.label : '—'}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-xs',
                        hasQuality ? qualityInfo.color : 'text-muted-foreground'
                      )}
                    >
                      {hasQuality ? t('qualityChange') : t('unchanged')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Material Details — input above output with a direction arrow between */}
            <div className="flex flex-col gap-3">
              {/* Input Material Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    {t('inputMaterialDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {enhanced?.inputMaterial?.quantity !== undefined && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('quantity')}
                        </span>
                        <span className="font-medium text-right break-words">
                          {enhanced.inputMaterial.quantity.toLocaleString()}{' '}
                          {enhanced.inputMaterial.unit || ''}
                        </span>
                      </div>
                    )}
                    {enhanced?.inputMaterial?.lifecycleStage && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('lifecycle')}
                        </span>
                        <span className="font-medium text-xs">
                          {enhanced.inputMaterial.lifecycleStage.replace(
                            /_/g,
                            ' '
                          )}
                        </span>
                      </div>
                    )}
                    {enhanced?.inputMaterial?.categoryCode && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('category')}
                        </span>
                        <span className="font-medium text-right break-words">
                          {enhanced.inputMaterial.categoryCode}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Custom Properties */}
                  {enhanced?.inputMaterial?.customProperties &&
                    Object.keys(enhanced.inputMaterial.customProperties)
                      .length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('customProperties')}
                          </div>
                          {Object.entries(
                            enhanced.inputMaterial.customProperties
                          ).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-start justify-between gap-4 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-medium text-right break-words">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>

              {/* Direction: input flows down to output */}
              <div className="flex justify-center" aria-hidden="true">
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Output Material Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600" />
                    {t('outputMaterialDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {enhanced?.outputMaterial?.quantity !== undefined && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('quantity')}
                        </span>
                        <span className="font-medium text-right break-words">
                          {enhanced.outputMaterial.quantity.toLocaleString()}{' '}
                          {enhanced.outputMaterial.unit || ''}
                        </span>
                      </div>
                    )}
                    {enhanced?.outputMaterial?.lifecycleStage && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('lifecycle')}
                        </span>
                        <span className="font-medium text-xs">
                          {enhanced.outputMaterial.lifecycleStage.replace(
                            /_/g,
                            ' '
                          )}
                        </span>
                      </div>
                    )}
                    {enhanced?.outputMaterial?.categoryCode && (
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {t('category')}
                        </span>
                        <span className="font-medium text-right break-words">
                          {enhanced.outputMaterial.categoryCode}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Custom Properties */}
                  {enhanced?.outputMaterial?.customProperties &&
                    Object.keys(enhanced.outputMaterial.customProperties)
                      .length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('customProperties')}
                          </div>
                          {Object.entries(
                            enhanced.outputMaterial.customProperties
                          ).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-start justify-between gap-4 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-medium text-right break-words">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Process Properties (dynamic) — flat, no card (it's already in a sheet) */}
            {enhanced?.processProperties &&
              Object.keys(enhanced.processProperties).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('processProperties')}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(enhanced.processProperties).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-medium text-right break-words">
                            {String(value)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Notes — flat, like an object description */}
            {enhanced?.notes && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {t('processNotes')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {enhanced.notes}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="flex-shrink-0 pt-4 border-t mt-4">
          <Button onClick={onClose} className="w-full" variant="outline">
            {t('close')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { RelationshipDetailsSheet }
