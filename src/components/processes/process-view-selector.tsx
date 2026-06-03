'use client'

import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib'
import {
  ENABLED_PROCESS_VIEW_TYPES,
  ProcessViewType,
} from '@/constants/view-types'

export type { ProcessViewType }

interface ProcessViewSelectorProps {
  view: ProcessViewType
  onChange: (view: ProcessViewType) => void
  /** Views to hide at runtime (e.g. dashboard when PROCESS_DASHBOARD_ENABLED=false). */
  excludedViews?: ProcessViewType[]
}

export function ProcessViewSelector({
  view,
  onChange,
  excludedViews,
}: ProcessViewSelectorProps) {
  const t = useTranslations()
  const viewTypes = excludedViews?.length
    ? ENABLED_PROCESS_VIEW_TYPES.filter((v) => !excludedViews.includes(v.value))
    : ENABLED_PROCESS_VIEW_TYPES
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (value) onChange(value as ProcessViewType)
        }}
      >
        {viewTypes.map((viewType) => {
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
