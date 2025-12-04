'use client'

import React from 'react'
import {
  ArrowRight,
  Package,
  Settings,
  X,
  Recycle,
  Leaf,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from 'lucide-react'
import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Badge,
  ScrollArea,
} from '@/components/ui'
import { MaterialRelationship } from '@/types'
import type { EnhancedMaterialRelationship } from '@/types/sankey-metadata'

interface RelationshipDetailsSheetProps {
  relationship: MaterialRelationship | EnhancedMaterialRelationship | null
  isOpen: boolean
  onClose: () => void
}

const RelationshipDetailsSheet: React.FC<RelationshipDetailsSheetProps> = ({
  relationship,
  isOpen,
  onClose,
}) => {
  if (!relationship) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col max-h-screen">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Process Details
          </SheetTitle>
          <SheetDescription>
            Detailed information about this process relationship
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-6">
          <div className="space-y-6 pb-4 pr-4">
          {/* Process Information */}
          <div>
            <div className="text-sm font-medium text-blue-900">Process Name</div>
            <div className="text-lg font-semibold text-blue-800">
              {relationship.processName || 'Not specified'}
            </div>
          </div>

          {/* Quantity & Unit */}
          {(relationship.quantity || relationship.unit) && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-blue-900">Quantity</div>
                  <div className="text-xl font-bold text-blue-800">
                    {relationship.quantity?.toLocaleString() || 'Not specified'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-900">Unit</div>
                  <div className="text-xl font-bold text-blue-800">
                    {relationship.unit || 'Not specified'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Material Flow */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-blue-900">
              Material Flow
            </h3>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="text-center flex-1">
                <div className="text-sm font-medium text-blue-900">From</div>
                <div className="text-lg font-bold text-blue-800 mt-1">
                  {relationship.subject.name}
                </div>
              </div>

              <ArrowRight className="h-6 w-6 text-gray-400 mx-4" />

              <div className="text-center flex-1">
                <div className="text-sm font-medium text-green-900">To</div>
                <div className="text-lg font-bold text-green-800 mt-1">
                  {relationship.object.name}
                </div>
              </div>
            </div>
          </div>

          {/* Process Metadata */}
          {'processTypeCode' in relationship && relationship.processTypeCode && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Process Type</div>
              <Badge variant="outline" className="text-sm">
                {relationship.processTypeCode}
              </Badge>
            </div>
          )}

          {/* Flow Category & Characteristics */}
          {'flowCategory' in relationship && relationship.flowCategory && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Flow Category</div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={relationship.flowCategory === 'RECYCLING' ? 'default' : 'secondary'}
                  className="text-sm"
                >
                  {relationship.flowCategory === 'RECYCLING' && <Recycle className="h-3 w-3 mr-1" />}
                  {relationship.flowCategory === 'REUSE' && <Recycle className="h-3 w-3 mr-1" />}
                  {relationship.flowCategory === 'CIRCULAR' && <Leaf className="h-3 w-3 mr-1" />}
                  {relationship.flowCategory.replace('_', ' ')}
                </Badge>
                {'isCircular' in relationship && relationship.isCircular && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <Leaf className="h-3 w-3 mr-1" />
                    Circular Flow
                  </Badge>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Environmental Impact */}
          {(('emissionsTotal' in relationship && relationship.emissionsTotal) || 
            ('materialLossPercent' in relationship && relationship.materialLossPercent) ||
            ('qualityChangeCode' in relationship && relationship.qualityChangeCode)) && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                Environmental Impact
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {/* Emissions */}
                {'emissionsTotal' in relationship && relationship.emissionsTotal && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-orange-900">Carbon Emissions</div>
                      <div className="text-lg font-bold text-orange-800">
                        {relationship.emissionsTotal} {'emissionsUnit' in relationship ? relationship.emissionsUnit || 'kgCO2e' : 'kgCO2e'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Material Loss */}
                {'materialLossPercent' in relationship && relationship.materialLossPercent && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-red-900">Material Loss</div>
                      <div className="text-lg font-bold text-red-800">
                        {relationship.materialLossPercent}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Quality Change */}
                {'qualityChangeCode' in relationship && relationship.qualityChangeCode && (
                  <div className={`p-3 rounded-lg border ${
                    relationship.qualityChangeCode === 'UP' 
                      ? 'bg-green-50 border-green-200' 
                      : relationship.qualityChangeCode === 'DOWN'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-sm font-medium ${
                        relationship.qualityChangeCode === 'UP' 
                          ? 'text-green-900' 
                          : relationship.qualityChangeCode === 'DOWN'
                          ? 'text-yellow-900'
                          : 'text-gray-900'
                      }`}>
                        Quality Change
                      </div>
                      <div className="flex items-center gap-1">
                        {relationship.qualityChangeCode === 'UP' && <TrendingUp className="h-4 w-4 text-green-600" />}
                        {relationship.qualityChangeCode === 'DOWN' && <TrendingDown className="h-4 w-4 text-yellow-600" />}
                        {relationship.qualityChangeCode === 'SAME' && <Minus className="h-4 w-4 text-gray-600" />}
                        <span className={`font-bold ${
                          relationship.qualityChangeCode === 'UP' 
                            ? 'text-green-800' 
                            : relationship.qualityChangeCode === 'DOWN'
                            ? 'text-yellow-800'
                            : 'text-gray-800'
                        }`}>
                          {relationship.qualityChangeCode === 'UP' ? 'Upcycled' : 
                           relationship.qualityChangeCode === 'DOWN' ? 'Downcycled' : 
                           'Same Quality'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {'notes' in relationship && relationship.notes && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Notes
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">{relationship.notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Technical Details
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Input Object UUID</span>
                <span className="font-mono text-gray-900 break-all">
                  {relationship.subject.uuid}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Output Object UUID</span>
                <span className="font-mono text-gray-900 break-all">
                  {relationship.object.uuid}
                </span>
              </div>
            </div>
          </div>

          </div>
        </ScrollArea>

        {/* Actions - Fixed at bottom */}
        <div className="flex-shrink-0 pt-4 border-t bg-white">
          <Button onClick={onClose} className="w-full" variant="outline">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { RelationshipDetailsSheet }
