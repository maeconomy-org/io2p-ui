'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

import type { LabJobStatus } from '../fixtures'

/**
 * Status colours are LOCAL to the lab on purpose.
 *
 * `Badge`'s existing variants are two closed sets — the permission ramp owns slate/sky/amber/rose,
 * entity types own violet/emerald/indigo/fuchsia/teal — and reusing either for a job status would
 * make a running import look like a `write` grant on a screen that shows both. A third dimension
 * needs its own decision, so this is where that decision gets tried out rather than assumed.
 */
const STATUS_STYLE: Record<LabJobStatus, { dot: string; label: string }> = {
  draft: { dot: 'bg-muted-foreground/50', label: 'Draft' },
  queued: { dot: 'bg-muted-foreground', label: 'Queued' },
  running: { dot: 'bg-blue-500 animate-pulse', label: 'Running' },
  completed: { dot: 'bg-emerald-500', label: 'Completed' },
  completed_with_errors: {
    dot: 'bg-amber-500',
    label: 'Completed with errors',
  },
  failed: { dot: 'bg-destructive', label: 'Failed' },
  cancelled: { dot: 'bg-muted-foreground/50', label: 'Cancelled' },
}

/**
 * A dot plus a word, never colour alone — and the label is a lookup, not
 * `status.replace('_',' ')`, which is what renders "Completed with_errors" today.
 */
export function JobStatusBadge({ status }: { status: LabJobStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
      {style.label}
    </Badge>
  )
}

export function formatDuration(from: number | null, to: number | null): string {
  if (!from) return '—'
  const end = to ?? 1754301600000 // a fixed "now" so the lab renders deterministically
  const seconds = Math.max(0, Math.round((end - from) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

export function formatClock(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const n = (value: number) => value.toLocaleString('en-US')

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
