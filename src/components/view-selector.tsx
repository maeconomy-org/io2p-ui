'use client'

import { cn } from '@/lib'
import { useTranslations } from 'next-intl'
import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { ENABLED_OBJECT_VIEW_TYPES, ObjectViewType } from '@/constants'

export type ViewType = ObjectViewType

interface ViewSelectorProps {
  view: ViewType
  onChange: (view: ViewType) => void
}

export function ViewSelector({ view, onChange }: ViewSelectorProps) {
  const t = useTranslations()
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (value) {
            onChange(value as ViewType)
            localStorage.setItem('view', value)
          }
        }}
      >
        {ENABLED_OBJECT_VIEW_TYPES.map((viewType) => {
          const Icon = viewType.icon
          return (
            <Tooltip key={viewType.value}>
              <TooltipTrigger
                className={cn(
                  'hover:bg-muted',
                  view === viewType.value && 'bg-muted'
                )}
                asChild
              >
                <ToggleGroupItem
                  value={viewType.value}
                  aria-label={t(`viewSelector.${viewType.labelKey}`)}
                >
                  <Icon className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t(`viewSelector.${viewType.labelKey}`)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </ToggleGroup>
    </TooltipProvider>
  )
}
