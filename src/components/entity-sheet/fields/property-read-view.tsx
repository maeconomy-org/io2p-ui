'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, LayoutGrid, List, Paperclip } from 'lucide-react'

import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ViewToggle,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { usePreference } from '@/hooks/ui/use-preference'
import type { DraftProperty, DraftFile, DraftValue } from '@/lib/entity-body'

import { FilesDisclosure } from '../files'
import { DeletedRow } from './deleted-row'
import { FormulaSummary } from './formula-value-editor'
import { ValueNormalization, formulaBoundValueIds } from './value-normalization'
import {
  ValueProvenanceDisplay,
  labelForValueId,
  type DerivedValues,
} from './value-provenance'

/** Resolves a value id named in a formula trace to the label of the property holding it. */
type LabelForValue = (valueId: string) => string | undefined

// Deleted values still render (struck through), but they don't count toward a summary or a badge —
// "3 values" should mean three live ones.
function liveValues(p: DraftProperty) {
  return p.values.filter((v) => !v.deleted)
}

// Total files attached anywhere under a property (its own + its values') — drives the paperclip badge.
function fileCount(p: DraftProperty): number {
  return (
    (p.files?.length ?? 0) +
    liveValues(p).reduce((n, v) => n + (v.files?.length ?? 0), 0)
  )
}

function valueSummary(p: DraftProperty, manyLabel: string): string {
  const values = liveValues(p)
  if (values.length === 0) return '—'
  if (values.length === 1) return values[0].data || '—'
  return manyLabel
}

// Read-only Properties: a collapsible card per property (list) or a compact grid. Files stay inside
// their own collapsible disclosures (per §18.3) so a property with many values/files stays compact.
type FileChange = (
  localId: string,
  patch: Partial<DraftFile>,
  options?: { dirty?: boolean }
) => void

export function PropertyReadView({
  properties,
  derivedValues,
  entityId,
  onFileChange,
  allowFiles = true,
  allowViewToggle = true,
}: {
  properties: DraftProperty[]
  derivedValues: DerivedValues
  entityId?: string
  onFileChange?: FileChange
  /** False for entities io2p cannot attach files to (templates) — hides every file affordance. */
  allowFiles?: boolean
  /** False inside a flow row, where one toggle per row would repeat the same control. */
  allowViewToggle?: boolean
}) {
  const t = useTranslations()
  const [view, setView] = usePreference('propertiesView')
  const boundValueIds = useMemo(
    () => formulaBoundValueIds(derivedValues),
    [derivedValues]
  )

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('objects.detailsSheet.noProperties')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {allowViewToggle && (
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
      )}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">
          {properties.map((p, i) =>
            p.deleted ? (
              <DeletedRow key={p.id ?? i} label={p.label || p.key} />
            ) : (
              <div key={p.id ?? i} className="rounded-md border p-2.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{p.label || p.key}</span>
                  {allowFiles && fileCount(p) > 0 && (
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
                    t('objects.values', { count: liveValues(p).length })
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {properties.map((p, i) => (
            <PropertyCard
              key={p.id ?? i}
              property={p}
              derivedValues={derivedValues}
              boundValueIds={boundValueIds}
              labelForValue={(id) => labelForValueId(properties, id)}
              entityId={entityId}
              onFileChange={onFileChange}
              allowFiles={allowFiles}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PropertyCard({
  property,
  derivedValues,
  boundValueIds,
  labelForValue,
  entityId,
  onFileChange,
  allowFiles,
}: {
  property: DraftProperty
  derivedValues: DerivedValues
  boundValueIds: ReadonlySet<string>
  labelForValue: LabelForValue
  entityId?: string
  onFileChange?: FileChange
  allowFiles: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const count = allowFiles ? fileCount(property) : 0

  if (property.deleted) {
    return <DeletedRow label={property.label || property.key} />
  }

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
            t('objects.values', { count: liveValues(property).length })
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
        {allowFiles && (
          <FilesDisclosure
            files={property.files ?? []}
            editing={false}
            entityId={entityId}
            onChange={onFileChange}
          />
        )}
        {liveValues(property).length === 0 && (
          <span className="text-sm text-muted-foreground">
            {t('objects.detailsSheet.noProperties')}
          </span>
        )}
        {property.values.map((v, vi) => (
          <ValueRow
            key={v.id ?? vi}
            value={v}
            derivedValues={derivedValues}
            boundValueIds={boundValueIds}
            labelForValue={labelForValue}
            entityId={entityId}
            onFileChange={onFileChange}
            allowFiles={allowFiles}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ValueRow({
  value,
  derivedValues,
  boundValueIds,
  labelForValue,
  entityId,
  onFileChange,
  allowFiles,
}: {
  value: DraftValue
  derivedValues: DerivedValues
  boundValueIds: ReadonlySet<string>
  labelForValue: LabelForValue
  entityId?: string
  onFileChange?: FileChange
  allowFiles: boolean
}) {
  const t = useTranslations()
  const files = allowFiles ? (value.files ?? []) : []

  if (value.deleted) {
    return <DeletedRow label={value.data || '—'} />
  }

  const isDerived = !!value.id && derivedValues.has(value.id)
  const provenance = value.id ? derivedValues.get(value.id) : undefined

  /**
   * A recipe held on the value itself, with no evaluation trace beside it — that is a TEMPLATE
   * formula, stored inert until the template is applied. It has no `data`, so without the summary
   * the row would read "—" and look unconfigured.
   */
  if (value.calc?.formulaId && !provenance) {
    return (
      <div className="space-y-1">
        <FormulaSummary calc={value.calc} labelForValue={labelForValue} />
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

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{value.data || '—'}</span>
        <ValueNormalization
          value={value}
          usedInFormula={!!value.id && boundValueIds.has(value.id)}
        />
        {provenance ? (
          <ValueProvenanceDisplay
            provenance={provenance}
            labelForValue={labelForValue}
          />
        ) : (
          isDerived && (
            <Badge variant="outline" className="text-[10px]">
              {t('objects.propertyEditor.derived')}
            </Badge>
          )
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
