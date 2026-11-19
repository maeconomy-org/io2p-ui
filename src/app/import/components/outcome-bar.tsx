'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import { n } from './format'

export function OutcomeBar({
  total,
  processed,
  ok,
  failed,
  skipped,
  className,
}: {
  total: number
  processed: number
  ok: number
  failed: number
  skipped: number
  className?: string
}) {
  const t = useTranslations()
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        data-testid="outcome-bar"
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={processed}
        aria-label={t('import.outcome.summary', {
          ok: n(ok),
          failed: n(failed),
          skipped: n(skipped),
          total: n(total),
        })}
      >
        <div className="bg-emerald-500" style={{ width: `${pct(ok)}%` }} />
        <div className="bg-destructive" style={{ width: `${pct(failed)}%` }} />
        <div className="bg-amber-500" style={{ width: `${pct(skipped)}%` }} />
      </div>
      {/* Counts pre-formatted by `n` into plain `{count}`, never ICU `{count, number}`: `n()` uses
          the BROWSER locale, next-intl's ICU uses the APP locale — mixing them prints
          "1,847 created" beside "of 1.847" on one line. */}
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span
          data-testid="outcome-created"
          className="font-medium text-emerald-600 dark:text-emerald-400"
        >
          {t('import.outcome.created', { count: n(ok) })}
        </span>
        {failed > 0 && (
          <span data-testid="outcome-failed" className="text-destructive">
            {t('import.outcome.failed', { count: n(failed) })}
          </span>
        )}
        {skipped > 0 && (
          <span
            data-testid="outcome-skipped"
            className="text-amber-600 dark:text-amber-400"
          >
            {t('import.outcome.skipped', { count: n(skipped) })}
          </span>
        )}
        <span data-testid="outcome-total" className="text-muted-foreground">
          {t('import.outcome.of', { count: n(total) })}
        </span>
      </div>
    </div>
  )
}
