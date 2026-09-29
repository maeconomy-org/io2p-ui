'use client'

import { useCallback, useId, useMemo } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
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
import type { CalcInput, EntityRollupEntry } from 'io2p-client'

import { FileList, FilesToggle } from '../files'
import {
  CollapseAllContext,
  useCollapseAll,
  useCollapsible,
  useFilesDisclosure,
} from '../collapse-all'
import { ListToolbar } from './collapse-all-button'
import { DeletedRow } from './deleted-row'
import {
  RollupLine,
  RollupStaleBadge,
  holds,
  leftOut,
  orderBuckets,
  type NumericValues,
  ownFactor,
  ownShare,
  rollupSaysSomething,
} from './rollup-line'
import { FormulaSummary, useTemplateEquation } from './formula-value-editor'
import {
  ValueNormalization,
  derivedText,
  formulaBoundValueIds,
  multiplierKeysOf,
  ruleKey,
} from './value-normalization'
import {
  resolveQuantity,
  savedQuantityValues,
  valuesUnder,
  type ResolvedQuantity,
} from './quantity'
import {
  ValueProvenanceDisplay,
  labelForValueId,
  type DerivedValues,
} from './value-provenance'
import { fileCount, findValue, liveValues } from './property-values'

/** Resolves a value id named in a formula trace to the label of the property holding it. */
type LabelForValue = (valueId: string) => string | undefined

/**
 * The canonical unit of the property's own value, if it has one.
 *
 * `RollupLine` matches this against a bucket's `unit`, NOT its `dimension` — those are different
 * vocabularies (`kg` vs `mass`), and comparing across them never matches, which would open every
 * multi-bucket row. A bucket carries the canonical unit of its dimension and a value's `unit` is
 * canonical too, so the two are directly comparable.
 */
function ownUnit(values: NumericValues): string | undefined {
  // A left-out value is in no total, so its unit must not pick the headline.
  return values.find((v) => v.unit !== undefined && !leftOut(v))?.unit
}

/** The first values, then how many more: `12 kg · 30 kg · +1` says more than "3 values". */
function TemplateEquation({
  calc,
  labelForValue,
}: {
  calc: CalcInput
  labelForValue: LabelForValue
}) {
  const { equation } = useTemplateEquation(calc, labelForValue)
  return <>{equation ? `= ${equation}` : '—'}</>
}

function valueSummary(
  p: DraftProperty,
  display: (v: DraftValue) => string
): string {
  const values = liveValues(p)
  if (values.length === 0) return '—'
  const shown = values.slice(0, 2).map(display)
  const more = values.length - shown.length
  return more > 0 ? [...shown, `+${more}`].join(' · ') : shown.join(' · ')
}

// Short, plain words: a colour, a material, a code. Anything with a number, a file, a formula or a
// mark to show keeps its own row, where there is room for them.
const CHIP_MAX = 24

function chipsFit(
  values: DraftValue[],
  derivedValues: DerivedValues,
  boundValueIds: ReadonlySet<string>
): boolean {
  return (
    values.length > 1 &&
    values.every(
      (v) =>
        v.num === undefined &&
        !v.calc &&
        !(v.files?.length ?? 0) &&
        (v.data ?? '').length > 0 &&
        (v.data ?? '').length <= CHIP_MAX &&
        !(v.id && (derivedValues.has(v.id) || boundValueIds.has(v.id)))
    )
  )
}

const CHIPS_SHOWN = 5

function ValueChips({ values }: { values: DraftValue[] }) {
  const t = useTranslations()
  const [all, setAll] = useCollapsible()
  const shown = all ? values : values.slice(0, CHIPS_SHOWN)
  const hidden = values.length - shown.length
  return (
    <ul
      className="flex flex-wrap items-center gap-1.5"
      data-testid="value-chips"
    >
      {shown.map((v, i) => (
        <li
          key={v.id ?? i}
          className="rounded-full border bg-background px-2.5 py-0.5 text-sm"
        >
          {v.data}
        </li>
      ))}
      {(hidden > 0 || all) && values.length > CHIPS_SHOWN && (
        <li>
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            {all
              ? t('objects.properties.fewerValues')
              : t('objects.properties.moreValues', { count: hidden })}
          </button>
        </li>
      )}
    </ul>
  )
}

/**
 * How one value READS, with nothing when it has no text: the equation then names the variable
 * instead. A value switched from a formula to typed text (`calc: null`) reads as typed, not as the
 * number the server calculated before.
 */
function useReadableValue(derivedValues: DerivedValues) {
  const format = useFormatter()
  return useCallback(
    (value: DraftValue): string | undefined => {
      const typed = value.data || undefined
      if (!value.id || !derivedValues.has(value.id) || value.calc === null)
        return typed
      // The node keeps 12 significant digits; a reader needs a few. The row's title keeps them all.
      const readable = (n: number) =>
        Math.abs(n) >= 1 || n === 0
          ? format.number(n, { maximumFractionDigits: 3 })
          : format.number(n, { maximumSignificantDigits: 4 })
      return (
        derivedText(value, derivedValues.get(value.id), readable) ??
        (typed && readableData(typed, readable))
      )
    },
    [derivedValues, format]
  )
}

/**
 * How one value reads on its own — one definition for the grid summary, the collapsed header and
 * the row, so the same number cannot appear three ways in one sheet.
 */
export function useValueDisplay(derivedValues: DerivedValues) {
  const readableValue = useReadableValue(derivedValues)
  return useCallback(
    (value: DraftValue): string => readableValue(value) ?? '—',
    [readableValue]
  )
}

/**
 * The text a formula's input reads as, by the input's value id, in read AND edit mode. Undefined
 * when there is none, so `equationText` keeps the variable's name.
 */
export function useValueText(
  properties: DraftProperty[],
  derivedValues: DerivedValues
) {
  const readableValue = useReadableValue(derivedValues)
  return useCallback(
    (valueId: string): string | undefined => {
      const v = findValue(properties, valueId)?.value
      return v && readableValue(v)
    },
    [properties, readableValue]
  )
}

// A declared result arrives as text in its declared unit (`2.30258509299 kg`), so only its leading
// number is reformatted; anything else passes through.
function readableData(data: string, readable: (n: number) => string): string {
  const match = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(.*)$/i.exec(data)
  return match ? `${readable(Number(match[1]))}${match[2]}` : data
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
  siblingSource,
  heading,
}: {
  properties: DraftProperty[]
  /**
   * A section heading, for a sheet where the properties share a tab with other fields (a process's
   * Details). Edit mode shows the same heading above its list, so the section reads alike in both.
   */
  heading?: string
  /**
   * Every property a formula here may read. A process flow's formula may bind a value from another
   * flow or from the process itself, which `properties` (this flow's own) does not hold.
   */
  siblingSource?: DraftProperty[]
  derivedValues: DerivedValues
  /** Subtree totals keyed by RULE ID — one rule per key, per owner. Objects only. */
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
  const { generation, collapse } = useCollapseAll()
  const displayValue = useValueDisplay(derivedValues)
  const textForValue = useValueText(siblingSource ?? properties, derivedValues)
  const boundValueIds = useMemo(
    () => formulaBoundValueIds(derivedValues),
    [derivedValues]
  )
  // Cards read in name order; the draft keeps authoring order, which is the order
  // the node happened to return and means nothing to a reader.
  const sortedProperties = useMemo(
    () =>
      [...properties].sort((a, b) =>
        resolvePropertyLabel(a.key, a.label, locale).localeCompare(
          resolvePropertyLabel(b.key, b.label, locale),
          locale,
          { sensitivity: 'base', numeric: true }
        )
      ),
    [properties, locale]
  )

  // From the RAW map, not `liveRollups` below: an entry with nothing to show still names the key
  // its rule multiplies by, and that key's values are still inputs to a total.
  const multiplierKeys = useMemo(() => multiplierKeysOf(rollups), [rollups])
  const totalledKeys = useMemo(
    () =>
      new Set(
        [...(rollups?.values() ?? [])].map((e) => e.propertyKey.toLowerCase())
      ),
    [rollups]
  )
  const quantities = useMemo(
    () =>
      new Map(
        [...multiplierKeys].map((key) => [
          key,
          resolveQuantity(savedQuantityValues(properties, key, derivedValues)),
        ])
      ),
    [multiplierKeys, properties, derivedValues]
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
  // A formula value's facts live on its trace, not on the value. `failed`: core writes a failed
  // formula as `data: ''` with no number and NO parse, and skips it.
  const withTrace = useCallback(
    (values: DraftValue[]) =>
      values.map((v) => {
        const trace = v.id ? derivedValues.get(v.id) : undefined
        return {
          ...v,
          derived: !!v.id && derivedValues.has(v.id),
          failed: !!trace?.error,
          unitVerified: trace?.unitVerified,
        }
      }),
    [derivedValues]
  )

  const rollupCards = useMemo(() => {
    if (!liveRollups) return []
    // LIVE properties only. `liveValues` filters deleted VALUES, not a deleted PROPERTY —
    // whose values arrive unmarked — while the node sums live search entries. A deleted
    // `weight` on a parent whose child holds 12 kg made `onlyContributor` true and hid the
    // card outright; the same map feeds `multiplierValues`, so a deleted `quantity` scaled
    // a share the node never scaled.
    const byKey = new Map(
      properties.filter((p) => !p.deleted).map((p) => [p.key.toLowerCase(), p])
    )
    return (
      [...liveRollups.values()]
        .map((entry) => {
          // `undefined` when the rule names no multiplier; an EMPTY array when it names one this
          // object has no value for. `ownFactor` reads those two as different things — the first
          // is "no scaling", the second is "absent, so one".
          const multiplierKey = entry.multiplyBy?.propertyKey
          const property = byKey.get(entry.propertyKey)
          return {
            entry,
            property,
            // Every property under the key, as the node sums them: keys need not be unique.
            ownValues: property
              ? withTrace(valuesUnder(properties, entry.propertyKey))
              : [],
            // Every property under the key: keys need not be unique, and the node reads them all.
            multiplierValues: multiplierKey
              ? savedQuantityValues(
                  properties,
                  multiplierKey.toLowerCase(),
                  derivedValues
                )
              : undefined,
          }
        })
        // A rollup whose only contributor is this object restates the property
        // sitting directly above it — in canonical units, so it reads as a second
        // number. A leaf has nothing below to total; the card returns when a child
        // does.
        .filter(({ entry, property, ownValues: own, multiplierValues }) => {
          if (!property || entry.error) return true
          // `num`/`parse` are normalizer output and land with the READ, so a value
          // authored a moment ago carries neither. "Does anything below contribute?"
          // has no answer yet, and answering it "yes" flashed a card that vanished
          // on the next fetch.
          // Not for a formula value: it never gets a parse, and a failed one has no number either,
          // so it would read as "not yet read" for good and hide the card with its totals.
          const notYetRead = (v: (typeof own)[number]) =>
            !v.derived &&
            v.data !== undefined &&
            v.num === undefined &&
            v.parse === undefined
          if (own.some(notYetRead)) {
            return false
          }
          // The node counts the LIVE entities below this one, so `0` settles "is anything down
          // there?" outright. Compared against `undefined` rather than tested for falsiness: the
          // field is ABSENT when the subtree exceeded the size bound, and `!descendantCount` would
          // read that as "leaf" — wrong in the opposite direction, on the largest trees.
          //
          // Unless the rule MULTIPLIES. Then a leaf's total is not a restatement of its own value:
          // the property row reads 12 kg and the total reads 60 kg, so the card carries the one
          // figure the rule was created to produce. "Nothing below" stops meaning "nothing to say"
          // the moment a contributor is scaled.
          if (entry.descendantCount === 0 && !entry.multiplyBy) return false

          const lead = orderBuckets(entry.buckets, ownUnit(own), own)[0]
          // With no bucket the entry can only report skips, and `ownShare` has
          // nothing to compare — which kept the card on every leaf whose values are
          // all unreadable ("5 lux"). Its own skips covering the count means the
          // object is again the sole contributor. Still reached when the count is
          // absent, which is the over-bound case. A value skipped because of the
          // object's own MULTIPLIER is deliberately not counted here: the card is the
          // only place that says it was dropped.
          if (!lead) {
            const unreadable = own.filter(
              (v) => v.parse?.ok === false || leftOut(v) || v.failed
            ).length
            return entry.skippedCount > unreadable
          }
          // A stale sum can predate the own values, but its counts move far less: this object is
          // the only contributor when every value in the lead total is its own, none scaled.
          // EVERY total, not only the lead: an own formula number without a unit leads the no-unit
          // total while a child's `3 pcs` sits in the count total, and judging the lead alone hid
          // the card with the child's total in it.
          if (entry.stale) {
            const unscaled =
              ownFactor(multiplierValues, entry.multiplyBy?.whenMissing) === 1
            return !entry.buckets.every((bucket) => {
              const mine = own.filter(
                (v) =>
                  v.num !== undefined &&
                  !leftOut(v) &&
                  holds(bucket, v, entry.buckets)
              ).length
              return unscaled && mine > 0 && mine === bucket.contributorCount
            })
          }
          return !entry.buckets.every(
            (bucket) =>
              ownShare(
                bucket,
                own,
                multiplierValues,
                entry.multiplyBy?.whenMissing,
                entry.buckets
              )?.onlyContributor
          )
        })
        .sort(
          (a, b) =>
            a.entry.propertyKey.localeCompare(b.entry.propertyKey) ||
            a.entry.ruleId.localeCompare(b.entry.ruleId)
        )
    )
  }, [liveRollups, properties, withTrace, derivedValues])

  // Not `properties.length` — an object whose rules all cover keys it never authored has only
  // orphan rows, and testing the properties alone would discard exactly those.
  const headingEl = heading && (
    <h3 className="text-sm font-medium">{heading}</h3>
  )

  if (properties.length === 0 && rollupCards.length === 0) {
    return (
      <div className="space-y-2">
        {headingEl}
        <p className="text-sm text-muted-foreground">
          {t('objects.detailsSheet.noProperties')}
        </p>
      </div>
    )
  }

  return (
    <CollapseAllContext.Provider value={generation}>
      <div className="space-y-3">
        {allowViewToggle && (
          <ListToolbar
            heading={headingEl}
            onCollapse={view !== 'grid' ? collapse : undefined}
          >
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
          </ListToolbar>
        )}

        {view === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {sortedProperties.map((p, i) =>
              p.deleted ? (
                <DeletedRow
                  key={p.id ?? i}
                  label={resolvePropertyLabel(p.key, p.label, locale)}
                />
              ) : (
                <div key={p.id ?? i} className="rounded-md border p-2.5">
                  {/* The grid is for scanning names and values; files and marks are on the rows. */}
                  <div className="truncate text-sm font-medium">
                    {resolvePropertyLabel(p.key, p.label, locale)}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {valueSummary(p, displayValue)}
                  </div>
                </div>
              )
            )}
            {rollupCards.map(
              ({ entry, property, ownValues, multiplierValues }) => (
                <RollupCard
                  compact
                  key={entry.ruleId}
                  entry={entry}
                  locale={locale}
                  ownUnit={property ? ownUnit(ownValues) : undefined}
                  ownValues={property ? ownValues : undefined}
                  multiplierValues={multiplierValues}
                />
              )
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedProperties.map((p, i) => (
              <PropertyCard
                key={p.id ?? i}
                property={p}
                derivedValues={derivedValues}
                boundValueIds={boundValueIds}
                quantity={quantities.get(ruleKey(p.key, p.label))}
                totalled={totalledKeys.has(ruleKey(p.key, p.label))}
                labelForValue={(id) =>
                  labelForValueId(siblingSource ?? properties, id, locale)
                }
                textForValue={textForValue}
                displayValue={displayValue}
                entityId={entityId}
                onFileChange={onFileChange}
                allowFiles={allowFiles}
              />
            ))}
            {rollupCards.map(
              ({ entry, property, ownValues, multiplierValues }) => (
                <RollupCard
                  key={entry.ruleId}
                  entry={entry}
                  locale={locale}
                  ownUnit={property ? ownUnit(ownValues) : undefined}
                  ownValues={property ? ownValues : undefined}
                  multiplierValues={multiplierValues}
                />
              )
            )}
          </div>
        )}
      </div>
    </CollapseAllContext.Provider>
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
  multiplierValues,
  ownUnit: unit,
  compact = false,
  'data-testid': testId = 'rollup-card',
}: {
  entry: EntityRollupEntry
  locale: PropertyDictionaryLocale
  ownValues?: NumericValues
  multiplierValues?: NumericValues
  ownUnit?: string
  /** Grid tile: the name and the total only; the breakdown and the marks are in the list view. */
  compact?: boolean
  'data-testid'?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useCollapsible()
  const detailsId = useId()

  const updating = entry.stale && !entry.error
  // Something below was not added in. At rest the card says only that there is something to look
  // at; the counts and reasons are in the expanded part.
  const issue = entry.skippedCount > 0

  if (compact) {
    return (
      <div
        className="rounded-md border border-dashed bg-muted/20 p-2.5"
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
          {updating && <RollupStaleBadge className="ml-auto" />}
        </div>
        <RollupLine
          entry={entry}
          ownUnit={unit}
          ownValues={ownValues}
          multiplierValues={multiplierValues}
          part="value"
          className={cn('mt-0.5', updating && 'opacity-60')}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-dashed transition-colors',
        updating
          ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'bg-muted/20'
      )}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        data-testid="rollup-toggle"
        className="flex w-full items-start gap-1.5 rounded-md px-3 py-1.5 text-left hover:bg-muted/40"
      >
        {/* The number and its name dim TOGETHER, in their own wrapper: opacity does not
            compose upward, so dimming the card would take the badges down with them. */}
        <div
          className={cn(
            'min-w-0 flex-1 transition-opacity',
            updating && 'opacity-60'
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
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
              {t('objects.properties.rollupTotal')}
            </Badge>
          </div>
          <RollupLine
            entry={entry}
            ownUnit={unit}
            ownValues={ownValues}
            multiplierValues={multiplierValues}
            part="value"
            className="mt-0.5"
          />
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {issue && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
              role="img"
              aria-label={t('objects.properties.rollupSkipped', {
                count: entry.skippedCount,
              })}
              data-testid="rollup-issue"
            />
          )}
          {updating && <RollupStaleBadge />}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          id={detailsId}
          className={cn(
            'space-y-1 border-t border-dashed px-3 py-1.5 transition-opacity',
            updating && 'opacity-60'
          )}
        >
          {/* A scaled total is not the sum of the values on the rows: 12 kg at a quantity of 5
              reads 60 kg. Naming the multiplier is what stops that looking like an error. */}
          {entry.multiplyBy && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="rollup-multiplier"
            >
              {t('objects.properties.rollupMultipliedBy', {
                key: resolvePropertyLabel(
                  entry.multiplyBy.propertyKey,
                  undefined,
                  locale
                ),
              })}
            </p>
          )}
          <RollupLine
            entry={entry}
            ownUnit={unit}
            ownValues={ownValues}
            multiplierValues={multiplierValues}
            part="details"
          />
        </div>
      )}
    </div>
  )
}

function PropertyCard({
  property,
  derivedValues,
  boundValueIds,
  quantity,
  totalled = false,
  labelForValue,
  textForValue,
  displayValue,
  entityId,
  onFileChange,
  allowFiles,
}: {
  property: DraftProperty
  derivedValues: DerivedValues
  boundValueIds: ReadonlySet<string>
  /** Set when a rollup rule scales its totals by this key: how the node resolves that quantity. */
  quantity?: ResolvedQuantity
  /** A rollup rule adds up this property's values. */
  totalled?: boolean
  labelForValue: LabelForValue
  textForValue: LabelForValue
  displayValue: (value: DraftValue) => string
  entityId?: string
  onFileChange?: FileChange
  allowFiles: boolean
}) {
  const t = useTranslations()
  const locale = useLocale() as PropertyDictionaryLocale
  const { open, setOpen, filesOpen, toggleFiles } = useFilesDisclosure()
  const filesId = useId()
  const count = allowFiles ? fileCount(property) : 0
  const ownFiles = allowFiles ? (property.files?.length ?? 0) : 0
  const live = liveValues(property)
  // A dictionary term reads in the viewer's own language; anything else keeps the authored text.
  const displayLabel = resolvePropertyLabel(
    property.key,
    property.label,
    locale
  )
  // A template formula has no result yet, so closed it reads as its equation, not as "—".
  const inert =
    live.length === 1 &&
    live[0].calc?.formulaId &&
    !(live[0].id && derivedValues.has(live[0].id))
      ? live[0].calc
      : undefined

  if (property.deleted) {
    return <DeletedRow label={displayLabel} />
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border', open && 'shadow-sm')}
    >
      <div className="flex items-center hover:bg-muted/50">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-3 pr-2 text-left">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          <span className="truncate text-sm font-medium">{displayLabel}</span>
          {/* Open, the values are right below; the header would only repeat them. */}
          <span className="ml-2 min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {!open &&
              (inert ? (
                <TemplateEquation calc={inert} labelForValue={labelForValue} />
              ) : (
                valueSummary(property, displayValue)
              ))}
          </span>
        </CollapsibleTrigger>
        {/* The property's own files open from its header, beside the trigger (a button cannot
            nest in one). Files on its values open from each value's line; while the property is
            closed, their count is only a hint. */}
        {ownFiles > 0 ? (
          <FilesToggle
            count={ownFiles}
            open={filesOpen}
            onToggle={toggleFiles}
            controls={filesId}
            label={t('objects.files.onProperty')}
            className="mr-2"
          />
        ) : (
          count > 0 &&
          !open && (
            <span
              className="mr-3 flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
              title={t('objects.files.onValues', { count })}
              aria-label={t('objects.files.onValues', { count })}
              role="img"
            >
              <Paperclip className="h-3 w-3" />
              {count}
            </span>
          )
        )}
      </div>

      <CollapsibleContent className="space-y-2 border-t bg-muted/10 px-3 py-2">
        {filesOpen && (
          <FileList
            id={filesId}
            files={property.files ?? []}
            entityId={entityId}
          />
        )}
        {liveValues(property).length === 0 && (
          <span className="text-sm text-muted-foreground">
            {t('objects.detailsSheet.noProperties')}
          </span>
        )}
        {/* A key a rule multiplies by keeps its rows: a refused quantity's mark lives there. */}
        {quantity === undefined &&
        chipsFit(live, derivedValues, boundValueIds) ? (
          <>
            <ValueChips values={live} />
            {property.values
              .filter((v) => v.deleted)
              .map((v, vi) => (
                <DeletedRow key={v.id ?? vi} label={v.data || '—'} />
              ))}
          </>
        ) : (
          <div className="divide-y divide-border/60 [&>*]:py-1.5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            {property.values.map((v, vi) => (
              <ValueRow
                key={v.id ?? vi}
                value={v}
                derivedValues={derivedValues}
                boundValueIds={boundValueIds}
                quantity={quantity}
                labelForValue={labelForValue}
                textForValue={textForValue}
                displayValue={displayValue}
                entityId={entityId}
                onFileChange={onFileChange}
                allowFiles={allowFiles}
              />
            ))}
          </div>
        )}
        {/* Several numbers under a key a total adds up: each one is added, which is easy to miss
            when a second value was meant to correct the first. */}
        {totalled && live.filter((v) => v.num !== undefined).length > 1 && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="values-totalled"
          >
            {t('objects.properties.valuesTotalled', {
              count: live.filter((v) => v.num !== undefined).length,
            })}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ValueRow({
  value,
  derivedValues,
  boundValueIds,
  quantity,
  labelForValue,
  textForValue,
  displayValue,
  entityId,
  onFileChange,
  allowFiles,
}: {
  value: DraftValue
  derivedValues: DerivedValues
  boundValueIds: ReadonlySet<string>
  quantity?: ResolvedQuantity
  labelForValue: LabelForValue
  textForValue: LabelForValue
  displayValue: (value: DraftValue) => string
  entityId?: string
  onFileChange?: FileChange
  allowFiles: boolean
}) {
  const t = useTranslations()
  const files = allowFiles ? (value.files ?? []) : []
  const [filesOpen, setFilesOpen] = useCollapsible()
  const filesId = useId()

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
          <FileList id={filesId} files={files} entityId={entityId} />
        )}
      </div>
    )
  }

  const marker = (
    <ValueNormalization
      value={value}
      quantity={quantity}
      usedInFormula={!!value.id && boundValueIds.has(value.id)}
      usedAsMultiplier={quantity !== undefined}
      derived={isDerived}
    />
  )

  // At the right end of the value's line, like the formula's toggle: they belong to this value.
  const filesToggle = files.length > 0 && (
    <FilesToggle
      count={files.length}
      open={filesOpen}
      onToggle={() => setFilesOpen((v) => !v)}
      controls={filesId}
      label={t('objects.files.onValue')}
    />
  )

  return (
    <div className="space-y-1">
      {provenance ? (
        <ValueProvenanceDisplay
          provenance={provenance}
          unit={value.unit}
          display={displayValue(value)}
          exact={value.data}
          labelForValue={labelForValue}
          textForValue={textForValue}
          marker={marker}
          trailing={filesToggle}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{displayValue(value)}</span>
          {marker}
          {isDerived && (
            <Badge variant="outline" className="text-[10px]">
              {t('objects.propertyEditor.derived')}
            </Badge>
          )}
          {filesToggle && <span className="ml-auto">{filesToggle}</span>}
        </div>
      )}
      {filesOpen && <FileList id={filesId} files={files} entityId={entityId} />}
    </div>
  )
}
