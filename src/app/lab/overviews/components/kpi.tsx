'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { Widget } from '../fixtures'
import { TREND, totalFor } from '../fixtures'

/** Deterministic stand-in for "the same measure, one period ago". */
const previousOf = (value: number) => value * 0.912

function format(value: number, decimals = 0) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * A KPI is a number plus everything needed to judge it.
 *
 * A bare figure is unreadable — 63.4 is good or bad depending on facts that live in someone's
 * head. Each option here supplies one of those facts: the unit says what it measures, the
 * comparison says which way it is moving, the target says what was promised, and the thresholds
 * say who decided what good looks like. All optional, because a count of objects needs none.
 */
export function Kpi({ widget }: { widget: Widget }) {
  const { display } = widget
  const value = totalFor(widget.query)
  const decimals = display.decimals ?? 0

  const previous = previousOf(value)
  const delta = value - previous
  const deltaPct = previous === 0 ? 0 : (delta / previous) * 100
  const up = delta >= 0

  const good = display.thresholds?.good
  const bad = display.thresholds?.bad
  const tone =
    good !== undefined && value >= good
      ? 'text-emerald-600 dark:text-emerald-400'
      : bad !== undefined && value <= bad
        ? 'text-destructive'
        : undefined

  const sparkMax = Math.max(...TREND.map((t) => t.value), 1)

  return (
    <div className="space-y-2">
      <p
        className={cn(
          'flex items-baseline gap-1 text-3xl font-semibold tabular-nums',
          tone
        )}
      >
        {format(value, decimals)}
        {display.unit && (
          <span className="text-base font-normal text-muted-foreground">
            {display.unit}
          </span>
        )}
      </p>

      {display.comparison === 'previous' && (
        <p className="flex items-center gap-1 text-xs">
          <span
            className={cn(
              'flex items-center gap-0.5 tabular-nums',
              up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
            )}
          >
            {up ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {up ? '+' : ''}
            {deltaPct.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </p>
      )}

      {display.target !== undefined && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                value >= display.target ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{
                width: `${Math.min((value / display.target) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {Math.round((value / display.target) * 100)}% of a{' '}
            {format(display.target, decimals)}
            {display.unit} target
          </p>
        </div>
      )}

      {display.sparkline && (
        <svg
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          className="h-6 w-full"
          aria-hidden
        >
          <polyline
            points={TREND.map((point, i) => {
              const x = (i / (TREND.length - 1)) * 100
              const y = 18 - (point.value / sparkMax) * 16
              return `${x},${y}`
            }).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="text-muted-foreground/40"
          />
        </svg>
      )}
    </div>
  )
}
