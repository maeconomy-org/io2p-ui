'use client'

import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  /** Compact label shown on mobile for icon-less options (e.g. "EN"). */
  shortLabel?: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group. */
  ariaLabel?: string
  /** When set, each segment gets `data-testid="{testIdPrefix}-{value}"`. */
  testIdPrefix?: string
  className?: string
}

/**
 * Labeled segmented control with a sliding active indicator. Segments are
 * equal-width (`auto-cols-fr`) and sized to the widest label (`w-max`), so text
 * never clips and the indicator can translate by `activeIndex * 100%`.
 *
 * Implemented as a group of toggle buttons (`aria-pressed`) rather than an ARIA
 * radiogroup: it's fully keyboard-accessible with Tab + Enter/Space and needs no
 * arrow-key roving. On mobile each segment collapses — icon options to the icon,
 * icon-less options to a short code — while `aria-label` keeps the full name.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  testIdPrefix,
  className,
}: SegmentedControlProps<T>) {
  const count = options.length
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative grid w-max grid-flow-col auto-cols-fr rounded-lg bg-muted p-1',
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-md bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((opt) => {
        const Icon = opt.icon
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            data-testid={
              testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined
            }
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {opt.shortLabel && !Icon && (
              <span className="sm:hidden">{opt.shortLabel}</span>
            )}
            <span
              className={cn((Icon || opt.shortLabel) && 'hidden sm:inline')}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
