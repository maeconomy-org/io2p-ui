'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, LayoutGrid, List, Paperclip } from 'lucide-react'

import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ViewToggle,
} from '@/components/ui'
import { cn } from '@/lib'
import { usePreference } from '@/hooks/ui/use-preference'
import type { DraftProperty, DraftFile } from '@/lib/entity-body'

import { FilesDisclosure } from '../files'

// Total files attached anywhere under a property (its own + its values') — drives the paperclip badge.
function fileCount(p: DraftProperty): number {
  return (
    (p.files?.length ?? 0) +
    p.values.reduce((n, v) => n + (v.files?.length ?? 0), 0)
  )
}

function valueSummary(p: DraftProperty, manyLabel: string): string {
  if (p.values.length === 0) return '—'
  if (p.values.length === 1) return p.values[0].data || '—'
  return manyLabel
}

// Read-only Properties: a collapsible card per property (list) or a compact grid. Files stay inside
// their own collapsible disclosures (per §18.3) so a property with many values/files stays compact.
type FileChange = (localId: string, patch: Partial<DraftFile>) => void

export function PropertyReadView({
  properties,
  derivedValueIds,
  entityId,
  onFileChange,
}: {
  properties: DraftProperty[]
  derivedValueIds: Set<string>
  entityId?: string
  onFileChange?: FileChange
}) {
  const t = useTranslations()
  const [view, setView] = usePreference('propertiesView')

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('objects.detailsSheet.noProperties')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            {
              value: 'detailed',
              icon: List,
              label: t('objects.properties.detailedView'),
            },
            {
              value: 'grid',
              icon: LayoutGrid,
              label: t('objects.properties.passportView'),
            },
          ]}
        />
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">
          {properties.map((p, i) => (
            <div key={p.id ?? i} className="rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{p.label || p.key}</span>
                {fileCount(p) > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 shrink-0 gap-0.5 px-1 text-[10px]"
                  >
                    <Paperclip className="h-2.5 w-2.5" />
                    {fileCount(p)}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {valueSummary(
                  p,
                  t('objects.values', { count: p.values.length })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {properties.map((p, i) => (
            <PropertyCard
              key={p.id ?? i}
              property={p}
              derivedValueIds={derivedValueIds}
              entityId={entityId}
              onFileChange={onFileChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PropertyCard({
  property,
  derivedValueIds,
  entityId,
  onFileChange,
}: {
  property: DraftProperty
  derivedValueIds: Set<string>
  entityId?: string
  onFileChange?: FileChange
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const count = fileCount(property)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border', open && 'shadow-sm')}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted/50">
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className="truncate text-sm font-medium">
          {property.label || property.key}
        </span>
        <span className="ml-2 min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {valueSummary(
            property,
            t('objects.values', { count: property.values.length })
          )}
        </span>
        {count > 0 && (
          <Badge
            variant="secondary"
            className="h-4 shrink-0 gap-0.5 px-1 text-[10px]"
          >
            <Paperclip className="h-2.5 w-2.5" />
            {count}
          </Badge>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 border-t bg-muted/10 px-3 py-2">
        {/* Property-level files first (under the header), then each value with its own files. */}
        <FilesDisclosure
          files={property.files ?? []}
          editing={false}
          entityId={entityId}
          onChange={onFileChange}
        />
        {property.values.length === 0 && (
          <span className="text-sm text-muted-foreground">
            {t('objects.detailsSheet.noProperties')}
          </span>
        )}
        {property.values.map((v, vi) => (
          <ValueRow
            key={v.id ?? vi}
            value={v}
            derivedValueIds={derivedValueIds}
            entityId={entityId}
            onFileChange={onFileChange}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ValueRow({
  value,
  derivedValueIds,
  entityId,
  onFileChange,
}: {
  value: { id?: string; data?: string; files?: DraftFile[] }
  derivedValueIds: Set<string>
  entityId?: string
  onFileChange?: FileChange
}) {
  const t = useTranslations()
  const files = value.files ?? []
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span>{value.data || '—'}</span>
        {value.id && derivedValueIds.has(value.id) && (
          <Badge variant="outline" className="text-[10px]">
            {t('objects.propertyEditor.derived')}
          </Badge>
        )}
      </div>
      {/* Indent the value's files so they read as belonging to the value above, not the property. */}
      {files.length > 0 && (
        <div className="border-l pl-3">
          <FilesDisclosure
            files={files}
            editing={false}
            entityId={entityId}
            onChange={onFileChange}
          />
        </div>
      )}
    </div>
  )
}
