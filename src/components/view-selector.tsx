'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { ENABLED_OBJECT_VIEW_TYPES, ObjectViewType } from '@/constants'

export type ViewType = ObjectViewType

export interface ViewOption {
  readonly value: string
  readonly labelKey: string
  readonly icon: LucideIcon
}

interface ViewSelectorProps<T extends string> {
  view: T
  onChange: (view: T) => void
  /** Defaults to the object views, which is what this was built for. */
  options?: readonly ViewOption[]
  'data-tour'?: string
}

/**
 * The segmented view switcher, shared by every page that has more than one way to render the same
 * data. Options are passed in so processes and objects look and behave identically rather than each
 * growing its own toggle.
 */
export function ViewSelector<T extends string>({
  view,
  onChange,
  options = ENABLED_OBJECT_VIEW_TYPES,
  'data-tour': dataTour,
}: ViewSelectorProps<T>) {
  const t = useTranslations()
  return (
    <div
      className="inline-flex h-8 items-center rounded-md border bg-muted p-0.5"
      data-tour={dataTour}
    >
      {options.map((option) => {
        const Icon = option.icon
        const active = view === option.value
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`view-option-${option.value}`}
            onClick={() => onChange(option.value as T)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={t(`viewSelector.${option.labelKey}`)}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
