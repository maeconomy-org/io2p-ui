'use client'

import { cn } from '@/lib'
import { useTranslations } from 'next-intl'
import { ENABLED_OBJECT_VIEW_TYPES, ObjectViewType } from '@/constants'

export type ViewType = ObjectViewType

interface ViewSelectorProps {
  view: ViewType
  onChange: (view: ViewType) => void
  'data-tour'?: string
}

export function ViewSelector({
  view,
  onChange,
  'data-tour': dataTour,
}: ViewSelectorProps) {
  const t = useTranslations()
  return (
    <div
      className="inline-flex h-8 items-center rounded-md border bg-muted p-0.5"
      data-tour={dataTour}
    >
      {ENABLED_OBJECT_VIEW_TYPES.map((viewType) => {
        const Icon = viewType.icon
        return (
          <button
            key={viewType.value}
            type="button"
            onClick={() => {
              onChange(viewType.value as ViewType)
              localStorage.setItem('view', viewType.value)
            }}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              view === viewType.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={t(`viewSelector.${viewType.labelKey}`)}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}
