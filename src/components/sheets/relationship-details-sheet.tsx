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
  ChevronRight,
  FileText,
  Scale,
} from 'lucide-react'
import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  ScrollArea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { MaterialRelationship } from '@/types'
import type { EnhancedMaterialRelationship, FlowCategory, QualityChangeCode } from '@/types/sankey-metadata'

interface RelationshipDetailsSheetProps {
  relationship: MaterialRelationship | EnhancedMaterialRelationship | null
  isOpen: boolean
  onClose: () => void
}

// Flow category label
const getFlowCategoryLabel = (category?: FlowCategory) => {
  switch (category) {
    case 'RECYCLING': return 'Recycling'
    case 'REUSE': return 'Reuse'
    case 'CIRCULAR': return 'Circular'
    case 'DOWNCYCLING': return 'Downcycling'
    case 'WASTE_FLOW': return 'Waste Flow'
    default: return 'Standard'
  }
}

// Quality change label and styling
const getQualityInfo = (code?: QualityChangeCode) => {
  switch (code) {
    case 'UP':
      return { label: 'Upcycled', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    case 'DOWN':
      return { label: 'Downcycled', icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
    default:
      return { label: 'Same Quality', icon: Minus, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' }
  }
}

const RelationshipDetailsSheet: React.FC<RelationshipDetailsSheetProps> = ({
  relationship,
  isOpen,
  onClose,
}) => {
  if (!relationship) return null

  // Type guard to check if relationship is enhanced
  const isEnhanced = (rel: any): rel is EnhancedMaterialRelationship => {
    return 'inputMaterial' in rel || 'outputMaterial' in rel || 'flowCategory' in rel
  }

  const enhanced = isEnhanced(relationship) ? relationship : null

  // Check if we have environmental impact data
  const hasEmissions = enhanced?.emissionsTotal && enhanced.emissionsTotal > 0
  const hasLoss = enhanced?.materialLossPercent && enhanced.materialLossPercent > 0
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
            {relationship.processName || 'Unnamed Process'}
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
            
            {/* Visual Flow Diagram */}
            <div>
              <div className="flex items-center justify-between gap-4">
                {/* Input */}
                <div className="flex-1">
                  <div className="bg-background rounded-lg p-4 border border-blue-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600 uppercase">Input</span>
                    </div>
                    <div className="font-semibold text-foreground">
                      {relationship.subject.name}
                    </div>
                    {enhanced?.inputMaterial?.quantity !== undefined && (
                      <div className="text-sm text-muted-foreground">
                        {enhanced.inputMaterial.quantity.toLocaleString()} {enhanced.inputMaterial.unit || 'units'}
                      </div>
                    )}
                    {enhanced?.inputMaterial?.lifecycleStage && (
                      <div className="text-xs text-blue-600">
                        {enhanced.inputMaterial.lifecycleStage.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-1 px-2 flex-shrink-0">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Output */}
                <div className="flex-1">
                  <div className="bg-background rounded-lg p-4 border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-600 uppercase">Output</span>
                    </div>
                    <div className="font-semibold text-foreground">
                      {relationship.object.name}
                    </div>
                    {enhanced?.outputMaterial?.quantity !== undefined && (
                      <div className="text-sm text-muted-foreground">
                        {enhanced.outputMaterial.quantity.toLocaleString()} {enhanced.outputMaterial.unit || 'units'}
                      </div>
                    )}
                    {enhanced?.outputMaterial?.lifecycleStage && (
                      <div className="text-xs text-emerald-600">
                        {enhanced.outputMaterial.lifecycleStage.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Metrics */}
            {hasImpactData && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  Environmental Impact
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {/* Emissions */}
                  <div className={`rounded-lg p-4 border ${hasEmissions ? 'bg-orange-50 border-orange-200' : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className={`h-4 w-4 ${hasEmissions ? 'text-orange-500' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-medium ${hasEmissions ? 'text-orange-700' : 'text-muted-foreground'}`}>Emissions</span>
                    </div>
                    <div className={`text-xl font-bold ${hasEmissions ? 'text-orange-900' : 'text-muted-foreground'}`}>
                      {hasEmissions ? enhanced?.emissionsTotal : '—'}
                    </div>
                    <div className={`text-xs ${hasEmissions ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      {hasEmissions ? (enhanced?.emissionsUnit || 'kgCO2e') : 'Not measured'}
                    </div>
                  </div>

                  {/* Material Loss */}
                  <div className={`rounded-lg p-4 border ${hasLoss ? 'bg-red-50 border-red-200' : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className={`h-4 w-4 ${hasLoss ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-medium ${hasLoss ? 'text-red-700' : 'text-muted-foreground'}`}>Material Loss</span>
                    </div>
                    <div className={`text-xl font-bold ${hasLoss ? 'text-red-900' : 'text-muted-foreground'}`}>
                      {hasLoss ? `${enhanced?.materialLossPercent}%` : '—'}
                    </div>
                    <div className={`text-xs ${hasLoss ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {hasLoss ? 'Lost in process' : 'No loss'}
                    </div>
                  </div>

                  {/* Quality Change */}
                  <div className={`rounded-lg p-4 border ${hasQuality ? `${qualityInfo.bg} ${qualityInfo.border}` : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Scale className={`h-4 w-4 ${hasQuality ? qualityInfo.color : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-medium ${hasQuality ? qualityInfo.color : 'text-muted-foreground'}`}>Quality</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasQuality && <QualityIcon className={`h-5 w-5 ${qualityInfo.color}`} />}
                      <span className={`text-lg font-bold ${hasQuality ? qualityInfo.color : 'text-muted-foreground'}`}>
                        {hasQuality ? qualityInfo.label : '—'}
                      </span>
                    </div>
                    <div className={`text-xs ${hasQuality ? qualityInfo.color : 'text-muted-foreground'}`}>
                      {hasQuality ? 'Quality change' : 'Unchanged'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Material Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Input Material Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    Input Material Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {enhanced?.inputMaterial?.quantity !== undefined && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-medium">
                          {enhanced.inputMaterial.quantity.toLocaleString()} {enhanced.inputMaterial.unit || ''}
                        </span>
                      </div>
                    )}
                    {enhanced?.inputMaterial?.lifecycleStage && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Lifecycle</span>
                        <span className="font-medium text-xs">
                          {enhanced.inputMaterial.lifecycleStage.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {enhanced?.inputMaterial?.categoryCode && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Category</span>
                        <span className="font-medium">{enhanced.inputMaterial.categoryCode}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Custom Properties */}
                  {enhanced?.inputMaterial?.customProperties && Object.keys(enhanced.inputMaterial.customProperties).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Properties</div>
                        {Object.entries(enhanced.inputMaterial.customProperties).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Output Material Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600" />
                    Output Material Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {enhanced?.outputMaterial?.quantity !== undefined && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-medium">
                          {enhanced.outputMaterial.quantity.toLocaleString()} {enhanced.outputMaterial.unit || ''}
                        </span>
                      </div>
                    )}
                    {enhanced?.outputMaterial?.lifecycleStage && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Lifecycle</span>
                        <span className="font-medium text-xs">
                          {enhanced.outputMaterial.lifecycleStage.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {enhanced?.outputMaterial?.categoryCode && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Category</span>
                        <span className="font-medium">{enhanced.outputMaterial.categoryCode}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Custom Properties */}
                  {enhanced?.outputMaterial?.customProperties && Object.keys(enhanced.outputMaterial.customProperties).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Properties</div>
                        {Object.entries(enhanced.outputMaterial.customProperties).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {enhanced?.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Process Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{enhanced.notes}</p>
                </CardContent>
              </Card>
            )}

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t mt-4">
          <Button onClick={onClose} className="w-full" variant="outline">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { RelationshipDetailsSheet }
