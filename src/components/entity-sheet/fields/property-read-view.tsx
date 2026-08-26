'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Calculator,
  ChevronRight,
  LayoutGrid,
  List,
  Paperclip,
} from 'lucide-react'

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
import { RollupLine, ownShare, rollupSaysSomething } from './rollup-line'
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

  /**
   * Every consumer below reads THIS map, not the prop.
   *
   * The node answers with one entry per rule ALWAYS — every rule visible to
   * you, on every object, related or not. Filtering once here is what keeps a
   * silent entry from reaching a property card as an empty "Subtree total"
   * line, and it cannot be forgotten at one of the call sites.
   */
  const liveRollups = useMemo(() => {
    if (!rollups) return undefined
    return new Map(
      [...rollups].filter(([, entry]) => rollupSaysSomething(entry))
    )
  }, [rollups])

  /**
   * EVERY rollup, as its own card — not just the ones with no matching property.
   *
   * A rule covering an authored key used to render inside that property's card,
   * so the same concept appeared two different ways depending on whether a
   * property happened to share its key. Each entry carries the own values of the
   * property it relates to (when there is one), which is what lets the card show
   * the own/below split without pretending to be that property.
   */
  const rollupCards = useMemo(() => {
    if (!liveRollups) return []
    const byKey = new Map(properties.map((p) => [p.key.toLowerCase(), p]))
    return (
      [...liveRollups.values()]
        .map((entry) => ({ entry, property: byKey.get(entry.propertyKey) }))
        // A rollup whose only contributor is this object restates the property
        // sitting directly above it — in canonical units, so it reads as a second
        // number. A leaf has nothing below to total; the card returns when a child
        // does.
        .filter(({ entry, property }) => {
          if (!property || entry.error) return true
          const own = liveValues(property)
          // `num`/`parse` are normalizer output and land with the READ, so a value
          // authored a moment ago carries neither. "Does anything below contribute?"
          // has no answer yet, and answering it "yes" flashed a card that vanished
          // on the next fetch.
          const notYetRead = (v: (typeof own)[number]) =>
            v.data !== undefined && v.num === undefined && v.parse === undefined
          if (own.some(notYetRead)) {
            return false
          }
          // The node counts the LIVE entities below this one, so `0` settles "is anything down
          // there?" outright. Compared against `undefined` rather than tested for falsiness: the
          // field is ABSENT when the subtree exceeded the size bound, and `!descendantCount` would
          // read that as "leaf" — wrong in the opposite direction, on the largest trees.
          if (entry.descendantCount === 0) return false

          const lead = [...entry.buckets].sort((a, b) => b.num - a.num)[0]
          // With no bucket the entry can only report skips, and `ownShare` has
          // nothing to compare — which kept the card on every leaf whose values are
          // all unreadable ("5 lux"). Its own skips covering the count means the
          // object is again the sole contributor. Still reached when the count is
          // absent, which is the over-bound case.
          if (!lead) {
            const unreadable = own.filter((v) => v.parse?.ok === false).length
            return entry.skippedCount > unreadable
          }
          return !ownShare(lead, own)?.onlyContributor
        })
        .sort((a, b) => a.entry.propertyKey.localeCompare(b.entry.propertyKey))
    )
  }, [liveRollups, properties])

  // Not `properties.length` — an object whose rules all cover keys it never authored has only
  // orphan rows, and testing the properties alone would discard exactly those.
  if (properties.length === 0 && rollupCards.length === 0) {
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
              </div>
            )
          )}
          {rollupCards.map(({ entry, property }) => (
            <RollupCard
              key={entry.ruleId}
              entry={entry}
              locale={locale}
              ownUnit={property ? ownUnit(property) : undefined}
              ownValues={property ? liveValues(property) : undefined}
            />
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
            />
          ))}
          {rollupCards.map(({ entry, property }) => (
            <RollupCard
              key={entry.ruleId}
              entry={entry}
              locale={locale}
              ownUnit={property ? ownUnit(property) : undefined}
              ownValues={property ? liveValues(property) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A rollup as its own card, never nested inside a property.
 *
 * Derived data is not a property: it is computed, it has no values, and nothing
 * about it can be edited. Rendering it inside the property card that happens to
 * share its key made one concept look like two — a number attached to a value
 * in one place and a standalone block in another. The dashed border already
 * meant "not authored" for orphans; now it means that everywhere, and the
 * calculator icon says why the card has no edit affordance rather than leaving
 * the reader to notice its absence.
 */
function RollupCard({
  entry,
  locale,
  ownValues,
  ownUnit: unit,
  'data-testid': testId = 'rollup-card',
}: {
  entry: EntityRollupEntry
  locale: PropertyDictionaryLocale
  ownValues?: readonly { num?: number; unit?: string }[]
  ownUnit?: string
  'data-testid'?: string
}) {
  const t = useTranslations()

  return (
    <div
      className="rounded-md border border-dashed bg-muted/20 px-3 py-1.5"
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5">
        <Calculator
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium">
          {resolvePropertyLabel(entry.propertyKey, undefined, locale)}
        </span>
        <Badge
          variant="secondary"
          className="h-4 shrink-0 px-1 text-[10px] font-normal"
        >
          {t('objects.properties.rollupDerived')}
        </Badge>
      </div>
      <RollupLine
        entry={entry}
        ownUnit={unit}
        ownValues={ownValues}
        className="mt-0.5"
      />
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
          ownValues={liveValues(property)}
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
