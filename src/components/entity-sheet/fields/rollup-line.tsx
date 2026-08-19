'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { ChevronRight, Sigma } from 'lucide-react'
import type { EntityRollupEntry, RollupBucket } from 'io2p-client'

import { cn } from '@/lib/utils'

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
   * Grid mode: one line, no expander. The compact card has nowhere to put a disclosure, so extra
   * dimensions are COUNTED there and read in the detailed view.
   */
  compact?: boolean
  className?: string
}) {
  const t = useTranslations()
  const buckets = [...entry.buckets].sort((a, b) => b.num - a.num)
  const [lead, ...rest] = buckets
  const foreign = rest.some((b) => b.unit !== ownUnit)
  const [open, setOpen] = useState(!compact && foreign)

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
        <span>{t('objects.properties.rollupNotCalculated')}</span>
      ) : (
        <>
          <BucketAmount bucket={lead} />
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
                    'h-3 w-3 transition-transform',
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

      {entry.stale && (
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
function BucketAmount({ bucket }: { bucket: RollupBucket }) {
  const t = useTranslations()
  const format = useFormatter()
  const amount = `${format.number(bucket.num)}${bucket.unit ? ` ${bucket.unit}` : ''}`

  return (
    <span className="flex items-center gap-1.5">
      <span className="font-medium text-foreground">{amount}</span>
      <span>
        {t('objects.properties.rollupContributors', {
          count: bucket.contributorCount,
        })}
      </span>
    </span>
  )
}
