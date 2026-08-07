'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

import type { ImportJobStatus } from '../types'

const STATUS_DOT: Record<ImportJobStatus, string> = {
  draft: 'bg-muted-foreground/50',
  queued: 'bg-muted-foreground',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-emerald-500',
  completed_with_errors: 'bg-amber-500',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground/50',
}

export function JobStatusBadge({ status }: { status: ImportJobStatus }) {
  const t = useTranslations()
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span
        className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
        aria-hidden
      />
      {t(`import.status.${status}`)}
    </Badge>
  )
}

export function formatDuration(
  from?: number | null,
  to?: number | null
): string {
  if (!from) return '—'
  const end = to ?? Date.now()
  const seconds = Math.max(0, Math.round((end - from) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

/** No locale argument on purpose: an instant follows the BROWSER, not the app's language. */
export function formatClock(ts?: number | null): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

/** Thousands separator from the BROWSER locale, like `formatClock` — not the app's. */
export const n = (value: number) => new Intl.NumberFormat().format(value)

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
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {t('import.outcome.created', { count: n(ok) })}
        </span>
        {failed > 0 && (
          <span className="text-destructive">
            {t('import.outcome.failed', { count: n(failed) })}
          </span>
        )}
        {skipped > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {t('import.outcome.skipped', { count: n(skipped) })}
          </span>
        )}
        <span className="text-muted-foreground">
          {t('import.outcome.of', { count: n(total) })}
        </span>
      </div>
    </div>
  )
}
