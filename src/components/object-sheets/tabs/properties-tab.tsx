'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Edit, LayoutGrid, List, Save, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import {
  PropertyGridView,
  PropertyItem,
  PropertySectionEditor,
} from '@/components/properties'
import type { UsePropertyEditorReturn } from '@/components/properties'

interface PropertiesTabProps {
  /** Original properties for display mode */
  properties: any[]
  /** Property editor hook return — single source of truth for edit mode */
  editor: UsePropertyEditorReturn
  /** Called after a successful save (e.g. to refetch aggregate) */
  onSaveComplete?: () => void
  /** Attachment modal state setter */
  setAttachmentModal: (modal: any) => void
}

export function PropertiesTab({
  properties,
  editor,
  onSaveComplete,
  setAttachmentModal,
}: PropertiesTabProps) {
  const t = useTranslations()
  const [viewMode, setViewMode] = useState<'detailed' | 'grid'>('detailed')
  const [isEditing, setIsEditing] = useState(false)

  // Handle attachment modal for properties and values
  const handleAttachFile = (
    propertyIndex: number,
    target: 'property' | 'value',
    valueIndex?: number
  ) => {
    const prop = properties[propertyIndex]
    if (target === 'property' && prop?.uuid) {
      setAttachmentModal({
        isOpen: true,
        type: 'property',
        propertyUuid: prop.uuid,
        propertyIndex,
        attachments: [],
      })
    } else if (target === 'value' && valueIndex !== undefined && prop?.uuid) {
      const value = prop.values?.[valueIndex]
      if (value?.uuid) {
        setAttachmentModal({
          isOpen: true,
          type: 'value',
          propertyUuid: prop.uuid,
          valueUuid: value.uuid,
          propertyIndex,
          valueIndex,
          attachments: [],
        })
      }
    }
  }

  const handleSave = async () => {
    try {
      await editor.saveProperties()
      onSaveComplete?.()
      setIsEditing(false)
    } catch {
      // Error handled in hook
    }
  }

  const handleCancel = () => {
    editor.resetProperties()
    setIsEditing(false)
  }

  return (
    <div className="space-y-3 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('objects.tabs.properties')}
        </h3>
        <div className="flex items-center gap-2">
          {/* View mode toggle — only in non-edit mode with properties */}
          {!isEditing && properties && properties.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center border rounded-md overflow-hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-testid="properties-detailed-view-toggle"
                      onClick={() => setViewMode('detailed')}
                      className={cn(
                        'p-1 transition-colors',
                        viewMode === 'detailed'
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('objects.properties.detailedView')}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-testid="properties-grid-view-toggle"
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'p-1 transition-colors',
                        viewMode === 'grid'
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('objects.properties.passportView')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          {/* Edit / Save / Cancel */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                data-testid="section-properties-cancel-button"
              >
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                data-testid="section-properties-save-button"
              >
                <Save className="h-4 w-4 mr-2" />
                {t('common.save')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="section-properties-edit-button"
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <PropertySectionEditor editor={editor} />
      ) : viewMode === 'grid' ? (
        <PropertyGridView properties={properties} />
      ) : properties.length > 0 ? (
        <div className="space-y-1.5">
          {properties.map((prop: any, idx: number) => {
            const propId = prop.uuid || `idx-${idx}`
            return (
              <PropertyItem
                key={propId}
                property={prop}
                isExpanded={editor.expandedIds.has(propId)}
                onToggle={() => editor.toggleExpand(propId)}
                isSaving={editor.isSavingProperty === propId}
                onAttachFile={
                  prop.uuid
                    ? (target, valueIndex) =>
                        handleAttachFile(idx, target, valueIndex)
                    : undefined
                }
              />
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('objects.noProperties')}
        </p>
      )}
    </div>
  )
}
