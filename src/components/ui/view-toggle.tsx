'use client'

import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface ViewToggleOption<T extends string> {
  value: T
  icon: LucideIcon
  /** Accessible name — icon-only buttons need one. */
  label: string
}

/** A compact segmented control for switching a view mode (list ⇄ grid, and friends). */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: ViewToggleOption<T>[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center overflow-hidden rounded-md border',
        className
      )}
    >
      {options.map(({ value: option, icon: Icon, label }) => (
        <button
          key={option}
          type="button"
          aria-label={label}
          aria-pressed={value === option}
          title={label}
          onClick={() => onChange(option)}
          className={cn(
            'p-1 transition-colors',
            value === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
