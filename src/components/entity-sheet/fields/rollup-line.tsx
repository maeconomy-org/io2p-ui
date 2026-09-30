'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import type { EntityRollupEntry, RollupBucket } from 'io2p-client'

import { cn } from '@/lib/utils'
import { round } from '@/lib/round'
import { uncheckedState } from './value-provenance'
import { resolveQuantity } from './quantity'

/**
 * Whether an entry says anything worth a line.
 *
 * The node returns ONE ENTRY PER RULE ALWAYS — every rule visible to you, on
 * every object, whether or not it relates to this one. So an object with four
 * system rules and one relevant property renders three empty blocks unless they
 * are filtered here.
 *
 * Kept when it has a number, hit the subtree cap, or counted values it could not
 * parse — that last one is the reason `skippedCount` is not merely cosmetic:
 * "7 values could not be read" is the signal that a unit is wrong somewhere
 * below.
 *
 * A NEVER-COMPUTED entry (`computedAt: null`) is still not kept, but no longer because the number
 * is not coming — a rule change now arms every holder of its key, so one is on its way. It is not
 * kept because there is nothing to show YET, and an "Updating…" block that resolves to an empty
 * result would appear only to vanish. The poll refetches while any entry is stale, so the card
 * arrives on its own.
 */
export function rollupSaysSomething(entry: EntityRollupEntry): boolean {
  return (
    entry.buckets.length > 0 ||
    entry.error !== undefined ||
    entry.skippedCount > 0
  )
}

export type NumericValues = readonly {
  num?: number
  unit?: string
  unitVerified?: boolean
  failed?: boolean
  /** A formula value: without a unit it is never a count. */
  derived?: boolean
}[]

/** The rule's answer for an object that has no value under the multiplier's key. */
type WhenMissing = NonNullable<EntityRollupEntry['multiplyBy']>['whenMissing']

/**
 * Whether the node sums this value into `bucket`, one of the entry's `buckets`.
 *
 * A value with a unit goes to that unit's bucket. A TYPED bare number is a count: the node merges
 * `5` into the key's `pcs` bucket, because `5` and `5 pcs` are one quantity, and keeps it unit-less
 * only where no count total exists. A formula result without a unit (a density, a ratio, an
 * unchecked canonical number) says nothing about pieces, so it is always unit-less. Both a count
 * and a unit-less total can therefore arrive together, which is why the answer for a bare value
 * needs the whole list.
 */
export function holds(
  bucket: RollupBucket,
  v: NumericValues[number],
  buckets: readonly RollupBucket[]
): boolean {
  if (!v.unit && (v.derived || uncheckedState(v, v.unit) === 'plain'))
    return bucket.dimension === 'unitless'
  if (v.unit) return bucket.unit === v.unit
  const pile = buckets.some((b) => b.dimension === 'count')
    ? 'count'
    : 'unitless'
  return bucket.dimension === pile
}

export const leftOut = (v: NumericValues[number]) =>
  uncheckedState(v, v.unit) === 'left-out'

/**
 * The factor the node applied to THIS object's contribution, mirroring how it resolves a
 * multiplier per row. `undefined` values mean the rule does not multiply at all.
 *
 * `null` means the node SKIPPED this object: a multiplier that is present but unreadable is
 * refused, never defaulted to one, because summing a contributor unscaled is the silent wrongness
 * the multiplier exists to prevent.
 *
 * An ABSENT multiplier is the rule's own choice. `one` counts the object once — "no quantity" and
 * "quantity 1" say the same thing — and `skip` leaves it out of the total altogether, so no share
 * of that total is this object's. The default mirrors the node, which fills `one` when the rule
 * stores nothing.
 */
export function ownFactor(
  values: NumericValues | undefined,
  whenMissing: WhenMissing = 'one'
): number | null {
  if (values === undefined) return 1 // the rule names no multiplier
  const quantity = resolveQuantity(values)
  if (quantity.kind === 'missing') return whenMissing === 'skip' ? null : 1
  return quantity.kind === 'number' ? quantity.value : null
}

/**
 * How the object's OWN value sits inside the lead bucket's total.
 *
 * `own` is in the bucket's canonical unit, not the authored one — a property
 * showing "0.8 t" beside a total of "800 kg" is one quantity printed two ways,
 * and the eye reads two facts. `DraftValue.num`/`unit` are already canonical
 * (the normalizer converts "2 t" to 2000 kg), which is the same basis the node
 * sums in, so no request and no conversion table is needed here.
 *
 * `below` is what the DESCENDANTS add — the number a reader is actually after
 * and currently has to do in their head, in the wrong units. Returned only when
 * every contributing unit matches the bucket's; a mixed-unit property cannot be
 * subtracted safely and gets no split.
 *
 * When the rule multiplies, the own values are SCALED first. Subtracting an unscaled own value
 * from a scaled total reported a difference that was not there: an object holding 100 kg at a
 * quantity of 3 contributes 300, and calling it 100 put the other 200 "below" an object that may
 * have nothing below it.
 */
export function ownShare(
  bucket: RollupBucket,
  ownValues: NumericValues,
  /** The object's live values under the key the rule multiplies by; omit when it names none. */
  multiplierValues?: NumericValues,
  /** What the rule does with an object holding no such value; the node's default is `one`. */
  whenMissing?: WhenMissing,
  /** Every bucket of the entry, `bucket` included: where a bare value lands depends on them all. */
  buckets: readonly RollupBucket[] = [bucket]
): { own: number; below: number; onlyContributor: boolean } | null {
  const contributing = ownValues.filter(
    (v) => v.num !== undefined && !leftOut(v) && holds(bucket, v, buckets)
  )
  if (contributing.length === 0) return null

  const factor = ownFactor(multiplierValues, whenMissing)
  if (factor === null) {
    // The node dropped this object's values, so none of the total is its own and it is not in
    // `contributorCount` either — everything shown belongs to the subtree below.
    return { own: 0, below: bucket.num, onlyContributor: false }
  }

  const own = round(
    contributing.reduce((sum, v) => sum + (v.num ?? 0), 0) * factor
  )
  const below = round(bucket.num - own)

  // No split while the total is BEHIND the value. The own values are live — they land with the
  // write — and `bucket.num` is derived asynchronously, up to a minute later (a 30s per-target
  // cooldown, a 30s reaper tick, a 30s poll). Edit a 12 kg value to 500 kg on a 120 kg total and
  // the subtraction produced "500 kg here, -380 kg below" for that whole window. The contributor
  // count is the honest fallback: it says less, but nothing false.
  //
  // Exactly zero must NOT be caught — that is an object which IS its own total, the commonest
  // case on a leaf. Rounding `own` first is what makes the two cancel exactly instead of landing
  // a few ulps under.
  if (below < 0) return null

  return {
    own,
    below,
    // Not `below === 0`: a descendant holding exactly zero is still a
    // contributor, and the count is what the node actually reports.
    //
    // A scaled contribution is never "the same number twice": the property row reads 12 kg and
    // the total reads 60 kg, so suppressing the total would hide the figure the rule was created
    // to produce. `factor === 1` is exact and needs no float comparison.
    onlyContributor:
      factor === 1 && bucket.contributorCount === contributing.length,
  }
}

/**
 * The entry's buckets in reading order: the one measuring what this property actually holds
 * first, then by magnitude.
 *
 * Sorting by `num` alone ranked a 5000 unitless bucket above a 120 kg one and made the bigger
 * number the headline — a total unrelated to the property being read, with the matching one
 * hidden behind the disclosure. `num` compares only WITHIN a dimension; across two it is a
 * coincidence of scale. Reachable whenever a subtree mixes `12 kg` with a bare `500`, since the
 * two never share a bucket.
 *
 * Exported because `property-read-view` picks the same lead to decide whether the card is worth
 * rendering at all. Two copies of this rule drift, and then they disagree about which bucket the
 * object is the sole contributor to.
 *
 * `ownValues` is not optional decoration. TWO different situations reach here as
 * `ownUnit: undefined` — the object holds a bare NUMBER, and the object holds nothing at all
 * (an orphan card, where no property carries the rule's key). Only the first is a count. Reading
 * the second as one pinned a `3 pcs` bucket above a `5000 kg` one and hid the larger total behind
 * the disclosure, which is this function's own failure case, inverted.
 */
export function orderBuckets(
  buckets: readonly RollupBucket[],
  ownUnit?: string,
  ownValues?: NumericValues
): RollupBucket[] {
  const leads = ownLead(buckets, ownUnit, ownValues)
  // After the own-lead rule, a total WITH a unit leads: a bare figure beside `11.2 kWh` says less,
  // however large it is.
  return [...buckets].sort(
    (a, b) =>
      Number(leads(b)) - Number(leads(a)) ||
      Number(b.unit !== undefined) - Number(a.unit !== undefined) ||
      b.num - a.num
  )
}

/**
 * Whether a bucket measures what this OBJECT holds — the ordering question, not the per-value one.
 *
 * With an own unit it is that unit. Without one it is the bucket some own bare number lands in:
 * no own value is not a bare number, and both arrive as `undefined`.
 */
function ownLead(
  buckets: readonly RollupBucket[],
  ownUnit?: string,
  ownValues?: NumericValues
): (bucket: RollupBucket) => boolean {
  if (ownUnit !== undefined) return (bucket) => bucket.unit === ownUnit
  const counted = (ownValues ?? []).filter(
    (v) => v.num !== undefined && !leftOut(v)
  )
  return (bucket) => counted.some((v) => holds(bucket, v, buckets))
}

/**
 * The subtree total for one property key: this object plus every descendant, summed by the node.
 *
 * A rollup is NOT a property and never becomes one — no value is written and no event is emitted,
 * so there is nothing to edit and no edit affordance to omit. It renders inside the property card
 * only because that is where the number it relates to already is.
 *
 * The total INCLUDES the object's own value, so the two overlap. Nothing here may read as
 * "children", and the two numbers must never invite addition.
 */
export function RollupLine({
  entry,
  ownUnit,
  ownValues,
  multiplierValues,
  part,
  className,
}: {
  entry: EntityRollupEntry
  /**
   * The canonical unit of the object's own value under this key, when it has one: the total in
   * that unit leads. Compared against `bucket.unit` — `bucket.dimension` is a different vocabulary
   * and would never match.
   */
  ownUnit?: string
  /**
   * The object's own live values under this key, for the own/below split. Their
   * canonical `num`/`unit` are what make the comparison honest — omit them and
   * the line falls back to the bare total.
   */
  ownValues?: NumericValues
  /**
   * The object's own live values under `entry.multiplyBy.propertyKey`. Absent when the rule names
   * no multiplier — which is NOT the same as an empty array, since that means the key is named and
   * this object simply has no value for it. What an empty array costs is the rule's `whenMissing`,
   * read from the entry itself.
   */
  multiplierValues?: NumericValues
  /**
   * Which half to render: `value` is the card at rest (the total alone), `details` is what opens
   * under it (the split, the other totals, the notes). Both when absent.
   */
  part?: 'value' | 'details'
  className?: string
}) {
  const t = useTranslations()
  const buckets = orderBuckets(entry.buckets, ownUnit, ownValues)
  const [lead, ...rest] = buckets

  // How many entities here or below hold MORE THAN ONE numeric value under the key — this one
  // included, so a leaf can report itself. Every such value counts toward the total, so a number
  // corrected by ADDING a second value instead of editing the first inflates it, and nothing else
  // on the card says so.
  //
  // The node counts these from the stored values alone, before any total is accumulated, so the
  // figure knows nothing about what was then skipped. Only with NOTHING skipped is "all counted"
  // provable; otherwise the count stands on its own as something to look at. Shown only beside a
  // total, because with no total there is nothing for it to explain.
  //
  // `?? 0` covers a row computed before the field existed. It is NOT what keeps the note off an
  // error card — the node omits the field entirely on that path, and the span renders outside the
  // error branch. If core ever sent both, this would count things it just said it could not total.
  const multiValue = entry.multiValueCount ?? 0
  const unverified = Math.min(
    entry.unverifiedUnitCount ?? 0,
    entry.skippedCount
  )

  // No split on a stale total: it may predate the own values and the rule's current multiplier,
  // and subtracting across that gap prints a "below" nobody can find.
  const share =
    lead && !entry.stale
      ? ownShare(
          lead,
          ownValues ?? [],
          multiplierValues,
          entry.multiplyBy?.whenMissing,
          entry.buckets
        )
      : null

  const showValue = part !== 'details'
  const showDetails = part !== 'value'

  const value = entry.error ? (
    <p className="text-destructive">
      {t('objects.properties.rollupSubtreeTooLarge')}
    </p>
  ) : lead === undefined ? (
    // Empty buckets mean one of two different things, and `computedAt`
    // is what separates them: `null` is "the worker has not run yet"
    // (synthesized entry, always `stale: true` — so the processing mark
    // is the whole message). A timestamp means it DID run and found
    // no numeric value under this key, which is a permanent answer, not a
    // pending one.
    entry.computedAt === null ? null : (
      <p>{t('objects.properties.rollupNoNumbers')}</p>
    )
  ) : (
    <LeadAmount bucket={lead} others={rest.length} />
  )

  return (
    <div
      className={cn('space-y-0.5 text-xs text-muted-foreground', className)}
      data-testid={part === 'details' ? 'rollup-details' : 'rollup-line'}
    >
      {showValue && value}
      {showDetails && lead !== undefined && !entry.error && (
        <>
          <LeadBreakdown bucket={lead} share={share} />
          {rest.length > 0 && (
            // Every other total, labelled, on one line: a total in the unit the reader expects
            // must not pass for part of a bare figure, nor hide behind it.
            <p
              className="flex flex-wrap items-center gap-1.5"
              data-testid="rollup-other-totals"
            >
              <span>{t('objects.properties.rollupAlso')}</span>
              {rest.map((bucket) => (
                <OtherTotal key={bucket.dimension} bucket={bucket} />
              ))}
            </p>
          )}
        </>
      )}
      {showDetails && entry.skippedCount > 0 && (
        <p
          data-testid="rollup-skipped"
          className="text-amber-700 dark:text-amber-400"
        >
          {t('objects.properties.rollupSkipped', { count: entry.skippedCount })}
          {/* Part of the skipped count, not added to it; absent on older rows means "not reported". */}
          {unverified > 0 && (
            <span data-testid="rollup-unverified">
              {' · '}
              {t('objects.properties.rollupUnverified', { count: unverified })}
            </span>
          )}
        </p>
      )}
      {showDetails && lead !== undefined && multiValue > 0 && (
        <p data-testid="rollup-multi-value">
          {t(
            entry.skippedCount === 0
              ? 'objects.properties.rollupMultiValueAllCounted'
              : 'objects.properties.rollupMultiValue',
            { count: multiValue }
          )}
        </p>
      )}
    </div>
  )
}

/**
 * A queued recompute, as an icon rather than a word: the line it sat on already carries the total,
 * the value count and the skip count, and a fourth phrase read as another fact about the number.
 * The label stays in the accessible name — a spinner alone says nothing to a screen reader, and
 * `motion-reduce` leaves it a static amber mark.
 */
export function RollupStaleBadge({ className }: { className?: string }) {
  const t = useTranslations()
  const label = t('objects.properties.rollupProcessing')

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      data-testid="rollup-stale"
      className={cn('flex shrink-0 items-center', className)}
    >
      <RefreshCw
        className="h-3.5 w-3.5 animate-spin text-amber-500 motion-reduce:animate-none dark:text-amber-400"
        aria-hidden="true"
      />
    </span>
  )
}

/**
 * The leading total as the card shows it at rest. `unit` is absent on the `unitless` bucket, which
 * is why it is appended conditionally rather than interpolated — the same shape
 * `ValueNormalization` uses.
 */
function LeadAmount({
  bucket,
  others,
}: {
  bucket: RollupBucket
  /** How many other totals the details hold, so the card at rest does not hide them. */
  others: number
}) {
  const t = useTranslations()
  const format = useFormatter()

  return (
    <p className="text-base font-semibold tabular-nums text-foreground">
      {format.number(bucket.num)}
      {bucket.unit ? ` ${bucket.unit}` : ''}
      {others > 0 && (
        <span
          className="ml-2 text-xs font-normal text-muted-foreground"
          data-testid="rollup-others"
        >
          {t('objects.properties.rollupOtherTotals', { count: others })}
        </span>
      )}
    </p>
  )
}

/** How the leading total is made up: this object's share and what is below, and the item count. */
function LeadBreakdown({
  bucket,
  share,
}: {
  bucket: RollupBucket
  share?: ReturnType<typeof ownShare>
}) {
  const t = useTranslations()
  const format = useFormatter()
  const unit = bucket.unit ? ` ${bucket.unit}` : ''
  // A card only shows when some total is not this object alone, so here another total sits
  // beside this one: say plainly that this one has nothing below it.
  if (share?.onlyContributor)
    return (
      <p data-testid="rollup-only-self">
        {t('objects.properties.rollupOnlyThisObject')}
      </p>
    )

  const split = share && bucket.num > 0 ? share : null

  // How many THINGS the values represent, when a rule scales them. Equal to `contributorCount`
  // otherwise, and the two differing is the only signal that a multiplier ran at all.
  //
  // The COUNT ONLY, never a per-unit figure. `num / unitCount` is a MEAN: five chairs at 12 kg
  // and two at 30 kg total 120 kg over 7 units, and dividing prints "7 x 17.143 kg" -- a weight
  // no chair has and nobody authored. The bucket carries sums, so whether the contributors were
  // uniform is not knowable here, and the honest reading of the average is unavailable.
  //
  // Still worth a line for a reason beyond arithmetic: a mis-keyed multiplier produces a
  // plausible total and a nonsense count. "120 kg, 4120 items" reads wrong at a glance where
  // "120 kg" alone does not.
  const scaled =
    bucket.unitCount !== undefined &&
    bucket.unitCount !== bucket.contributorCount &&
    bucket.unitCount > 0

  return (
    <p className="flex flex-wrap gap-x-1.5">
      {split ? (
        // BOTH halves as text, never a bar. A partly-filled pill beside a number is the
        // universal "X of Y done" idiom, and nothing here progresses toward anything -- this is
        // a composition, mine against my descendants'. And the remainder alone ("60 kg below")
        // reads as an amount SUBTRACTED from the total; naming the object's own share beside it
        // is what makes the two visibly add up.
        <span data-testid="rollup-split">
          {t('objects.properties.rollupSplitLabel', {
            own: `${format.number(split.own)}${unit}`,
            below: `${format.number(split.below)}${unit}`,
          })}
        </span>
      ) : (
        <span>
          {t('objects.properties.rollupContributors', {
            count: bucket.contributorCount,
          })}
        </span>
      )}
      {scaled && (
        <span data-testid="rollup-unit-count">
          {'· '}
          {t('objects.properties.rollupUnitCount', {
            count: bucket.unitCount as number,
          })}
        </span>
      )}
    </p>
  )
}

/** Another total under the same key, named by its unit, or as having none. */
function OtherTotal({ bucket }: { bucket: RollupBucket }) {
  const t = useTranslations()
  const format = useFormatter()
  return (
    <span className="rounded-full border bg-background px-2 tabular-nums text-foreground">
      {format.number(bucket.num)}
      {bucket.unit ? (
        ` ${bucket.unit}`
      ) : (
        <span className="text-muted-foreground">
          {' '}
          {t('objects.properties.rollupNoUnit')}
        </span>
      )}
    </span>
  )
}
