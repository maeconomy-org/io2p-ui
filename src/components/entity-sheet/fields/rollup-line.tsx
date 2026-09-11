'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ChevronRight, Sigma } from 'lucide-react'
import type { EntityRollupEntry, RollupBucket } from 'io2p-client'

import { cn } from '@/lib/utils'

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

/**
 * The node's own rounding policy, 12 significant digits (`shared/entity.normalize.ts`). Applied to
 * the browser-side own sum so it is comparable with a total the server already rounded: `0.1 + 0.2`
 * is `0.30000000000000004` here and `0.3` there, and the difference decides whether this object is
 * the whole total or is 4e-17 short of it.
 */
const round = (n: number) => Number(n.toPrecision(12))

type NumericValues = readonly { num?: number; unit?: string }[]

/**
 * The factor the node applied to THIS object's contribution, mirroring how it resolves a
 * multiplier per row. `undefined` values mean the rule does not multiply at all.
 *
 * `null` means the node SKIPPED this object: a multiplier that is present but unreadable is
 * refused, never defaulted to one, because summing a contributor unscaled is the silent wrongness
 * the multiplier exists to prevent. Only an ABSENT multiplier falls back to one — "no quantity"
 * and "quantity 1" say the same thing.
 */
export function ownFactor(values: NumericValues | undefined): number | null {
  if (values === undefined) return 1 // the rule names no multiplier
  if (values.length === 0) return 1 // absent -> one
  if (values.length > 1) return null // several live values -> ambiguous
  const [only] = values
  if (only?.num === undefined) return null // present but never parsed
  return only.num < 0 ? null : only.num
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
  multiplierValues?: NumericValues
): { own: number; below: number; onlyContributor: boolean } | null {
  const contributing = ownValues.filter(
    (v) => v.num !== undefined && v.unit === bucket.unit
  )
  if (contributing.length === 0) return null

  const factor = ownFactor(multiplierValues)
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
 */
export function orderBuckets(
  buckets: readonly RollupBucket[],
  ownUnit?: string
): RollupBucket[] {
  return [...buckets].sort(
    (a, b) =>
      Number(b.unit === ownUnit) - Number(a.unit === ownUnit) || b.num - a.num
  )
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
  compact = false,
  className,
}: {
  entry: EntityRollupEntry
  /**
   * The canonical unit of the object's own value under this key, when it has one. A hidden bucket
   * measuring something ELSE usually means a mis-keyed value, so that case opens by itself.
   * Compared against `bucket.unit` — `bucket.dimension` is a different vocabulary and would never
   * match.
   */
  ownUnit?: string
  /**
   * The object's own live values under this key, for the own/below split. Their
   * canonical `num`/`unit` are what make the comparison honest — omit them and
   * the line falls back to the bare total.
   */
  ownValues?: NumericValues
  /**
   * The object's own live values under `entry.multipliedBy`. Absent when the rule names no
   * multiplier — which is NOT the same as an empty array, since that means the key is named and
   * this object simply has no value for it.
   */
  multiplierValues?: NumericValues
  /**
   * Grid mode: one line, no expander. The compact card has nowhere to put a disclosure, so extra
   * dimensions are COUNTED there and read in the detailed view.
   */
  compact?: boolean
  className?: string
}) {
  const t = useTranslations()
  const buckets = orderBuckets(entry.buckets, ownUnit)
  const [lead, ...rest] = buckets
  const foreign = rest.some((b) => b.unit !== ownUnit)
  const [open, setOpen] = useState(!compact && foreign)

  const share = lead ? ownShare(lead, ownValues ?? [], multiplierValues) : null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground',
        className
      )}
      data-testid="rollup-line"
    >
      <span className="flex shrink-0 items-center gap-1">
        <Sigma className="h-3 w-3" />
        {t('objects.properties.rollupTotal')}
      </span>

      {entry.error ? (
        <span className="text-destructive">
          {t('objects.properties.rollupSubtreeTooLarge')}
        </span>
      ) : lead === undefined ? (
        // Empty buckets mean one of two different things, and `computedAt`
        // is what separates them: `null` is "the worker has not run yet"
        // (synthesized entry, always `stale: true` — so the processing line
        // below is the whole message). A timestamp means it DID run and found
        // no numeric value under this key, which is a permanent answer, not a
        // pending one.
        entry.computedAt === null ? null : (
          <span>{t('objects.properties.rollupNoNumbers')}</span>
        )
      ) : (
        <>
          <BucketAmount bucket={lead} share={share} />
          {rest.length > 0 &&
            (compact ? (
              <span>
                {t('objects.properties.rollupMoreDimensions', {
                  count: rest.length,
                })}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex items-center gap-0.5 underline-offset-2 hover:underline"
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 transition-transform motion-reduce:transition-none',
                    open && 'rotate-90'
                  )}
                />
                {t('objects.properties.rollupMoreDimensions', {
                  count: rest.length,
                })}
              </button>
            ))}
        </>
      )}

      {entry.stale && !entry.error && (
        <span data-testid="rollup-stale">
          {t('objects.properties.rollupProcessing')}
        </span>
      )}
      {entry.skippedCount > 0 && (
        <span data-testid="rollup-skipped">
          {t('objects.properties.rollupSkipped', { count: entry.skippedCount })}
        </span>
      )}

      {open && rest.length > 0 && (
        <ul className="w-full space-y-0.5 pt-0.5">
          {rest.map((bucket) => (
            <li key={bucket.dimension} className="flex items-center gap-2">
              <BucketAmount bucket={bucket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One dimension's sum. `unit` is absent on the `unitless` bucket, which is why it is appended
 * conditionally rather than interpolated — the same shape `ValueNormalization` uses.
 */
function BucketAmount({
  bucket,
  share,
}: {
  bucket: RollupBucket
  share?: ReturnType<typeof ownShare>
}) {
  const t = useTranslations()
  const format = useFormatter()
  const unit = bucket.unit ? ` ${bucket.unit}` : ''
  const amount = `${format.number(bucket.num)}${unit}`

  // The object IS the total. Saying it twice — once as the property's own value,
  // once as a "total" — invites the reader to look for a second number that does
  // not exist, so the line says so outright instead of restating the figure.
  if (share?.onlyContributor) {
    return (
      <span data-testid="rollup-only-self">
        {t('objects.properties.rollupOnlyThisObject')}
      </span>
    )
  }

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
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-medium text-foreground">{amount}</span>
      {scaled && (
        <span data-testid="rollup-unit-count">
          {t('objects.properties.rollupUnitCount', {
            count: bucket.unitCount as number,
          })}
        </span>
      )}
      {split ? (
        // BOTH halves as text, never a bar. A partly-filled pill beside a number is the
        // universal "X of Y done" idiom, and nothing here progresses toward anything -- this is
        // a composition, mine against my descendants'. And the remainder alone ("60 kg below")
        // reads as an amount SUBTRACTED from the total; naming the object's own share beside it
        // is what makes the two visibly add up. This wording already existed as the bar's
        // aria-label, so screen readers got the clear half and everyone else got the ambiguous one.
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
    </span>
  )
}
