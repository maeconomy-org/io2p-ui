'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import type { DraftProperty, DraftFile, DraftValue } from '@/lib/entity'

import {
  resolvePropertyLabel,
  type PropertyDictionaryLocale,
} from '@/constants/property-dictionary'
import type { EntityRollupEntry } from 'io2p-client'

import { FilesDisclosure } from '../files'
import { DeletedRow } from './deleted-row'
import { RollupLine } from './rollup-line'
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

/**
 * The canonical unit of the property's own value, if it has one.
 *
 * `RollupLine` matches this against a bucket's `unit`, NOT its `dimension` — those are different
 * vocabularies (`kg` vs `mass`), and comparing across them never matches, which would open every
 * multi-bucket row. A bucket carries the canonical unit of its dimension and a value's `unit` is
 * canonical too, so the two are directly comparable.
 */
function ownUnit(p: DraftProperty): string | undefined {
  return liveValues(p).find((v) => v.unit !== undefined)?.unit
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
  rollups,
  entityId,
  onFileChange,
  allowFiles = true,
  allowViewToggle = true,
}: {
  properties: DraftProperty[]
  derivedValues: DerivedValues
  /** Subtree totals keyed by lowercased property key. Objects only; absent elsewhere. */
  rollups?: ReadonlyMap<string, EntityRollupEntry>
  entityId?: string
  onFileChange?: FileChange
  /** False for entities io2p cannot attach files to (templates) — hides every file affordance. */
  allowFiles?: boolean
  /** False inside a flow row, where one toggle per row would repeat the same control. */
  allowViewToggle?: boolean
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const [view, setView] = usePreference('propertiesView')
  const boundValueIds = useMemo(
    () => formulaBoundValueIds(derivedValues),
    [derivedValues]
  )

  // A rule can cover a key this object never authored — the parent holds nothing, the descendants
  // hold it all. That is the most useful rollup there is, so it gets a row of its own rather than
  // being dropped for want of a property to decorate.
  const orphans = useMemo(() => {
    if (!rollups) return []
    const authored = new Set(properties.map((p) => p.key.toLowerCase()))
    return [...rollups.values()]
      .filter((entry) => !authored.has(entry.propertyKey))
      .sort((a, b) => a.propertyKey.localeCompare(b.propertyKey))
  }, [rollups, properties])

  // Not `properties.length` — an object whose rules all cover keys it never authored has only
  // orphan rows, and testing the properties alone would discard exactly those.
  if (properties.length === 0 && orphans.length === 0) {
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
                label: t('objects.properties.gridView'),
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
                {rollups?.get(p.key.toLowerCase()) && (
                  <RollupLine
                    entry={rollups.get(p.key.toLowerCase())!}
                    ownUnit={ownUnit(p)}
                    compact
                    className="mt-1"
                  />
                )}
              </div>
            )
          )}
          {orphans.map((entry) => (
            <div
              key={entry.ruleId}
              className="rounded-md border border-dashed p-2.5"
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">
                  {resolvePropertyLabel(entry.propertyKey, undefined, locale)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                —
              </div>
              <RollupLine entry={entry} compact className="mt-1" />
            </div>
          ))}
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
              rollup={rollups?.get(p.key.toLowerCase())}
            />
          ))}
          {orphans.map((entry) => (
            <OrphanRollupCard
              key={entry.ruleId}
              entry={entry}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A rollup covering a key this object never authored. Not collapsible: there are no values to
 * disclose, so a chevron would open onto nothing.
 */
function OrphanRollupCard({
  entry,
  locale,
}: {
  entry: EntityRollupEntry
  locale: PropertyDictionaryLocale
}) {
  return (
    <div
      className="rounded-md border border-dashed px-3 py-1.5"
      data-testid="orphan-rollup"
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">
          {resolvePropertyLabel(entry.propertyKey, undefined, locale)}
        </span>
        <span className="ml-2 text-sm text-muted-foreground">—</span>
      </div>
      <RollupLine entry={entry} className="mt-0.5" />
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
  rollup,
}: {
  property: DraftProperty
  derivedValues: DerivedValues
  boundValueIds: ReadonlySet<string>
  labelForValue: LabelForValue
  entityId?: string
  onFileChange?: FileChange
  allowFiles: boolean
  /** The subtree total for this property's key, when a rule covers it. */
  rollup?: EntityRollupEntry
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

      {/* OUTSIDE the collapsible content: the card is collapsed by default, and a total nobody can
          see without expanding is a total nobody reads. */}
      {rollup && (
        <RollupLine
          entry={rollup}
          ownUnit={ownUnit(property)}
          className="px-3 pb-1.5 pl-8"
        />
      )}

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
