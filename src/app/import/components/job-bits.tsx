'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

import type { ImportJobStatus } from '../types'

/**
 * Status colours are LOCAL to the lab on purpose.
 *
 * `Badge`'s existing variants are two closed sets — the permission ramp owns slate/sky/amber/rose,
 * entity types own violet/emerald/indigo/fuchsia/teal — and reusing either for a job status would
 * make a running import look like a `write` grant on a screen that shows both. A third dimension
 * needs its own decision, so this is where that decision gets tried out rather than assumed.
 */
// Only the colour lives here now; the word comes from `import.status.<status>`. The status id is
// already the natural key, and it kept the label out of a lookup the compiler cannot check.
const STATUS_DOT: Record<ImportJobStatus, string> = {
  draft: 'bg-muted-foreground/50',
  queued: 'bg-muted-foreground',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-emerald-500',
  completed_with_errors: 'bg-amber-500',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground/50',
}

/**
 * A dot plus a word, never colour alone — and the label is a lookup, not
 * `status.replace('_',' ')`, which is what renders "Completed with_errors" today.
 */
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
  // A running job has no finish time yet, so measure against the wall clock. (This was a fixed
  // literal while the page ran on fixtures, to keep the layout deterministic; the data is real
  // now, so an elapsed time that does not move would be a lie.)
  const end = to ?? Date.now()
  const seconds = Math.max(0, Math.round((end - from) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

/**
 * A wall-clock time in the READER's convention.
 *
 * Was hand-built as `HH:mm`, which forces 24-hour on every locale and pads in a way `Intl` would
 * not. No locale argument, so it follows the browser — these are timestamps, not copy, and they
 * are the same instant whichever language the UI is in.
 */
export function formatClock(ts?: number | null): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

/** Counts with the reader's thousands separator: 1,847 or 1.847. Was pinned to en-US. */
export const n = (value: number) => new Intl.NumberFormat().format(value)

/**
 * The bar shows POSITION (attempted / total). The numbers underneath show OUTCOME.
 *
 * Keeping them apart is the whole point: the old pipeline drove one bar off `processed` and it
 * reached 100% while rows had silently failed. `ok` is the only number that means success — and
 * deriving it as `processed - failed` counts every SKIPPED row as one, which is exactly what
 * happens to every child of a failed parent.
 */
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
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={processed}
        aria-label={`${n(ok)} created, ${n(failed)} failed, ${n(skipped)} skipped of ${n(total)}`}
      >
        <div className="bg-emerald-500" style={{ width: `${pct(ok)}%` }} />
        <div className="bg-destructive" style={{ width: `${pct(failed)}%` }} />
        <div className="bg-amber-500" style={{ width: `${pct(skipped)}%` }} />
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {n(ok)} created
        </span>
        {failed > 0 && (
          <span className="text-destructive">{n(failed)} failed</span>
        )}
        {skipped > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {n(skipped)} skipped
          </span>
        )}
        <span className="text-muted-foreground">of {n(total)}</span>
      </div>
    </div>
  )
}
