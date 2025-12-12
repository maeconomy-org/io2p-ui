'use client'

import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { cn } from '@/lib'
import {
  ENABLED_PROCESS_VIEW_TYPES,
  ProcessViewType,
} from '@/constants/view-types'

export type { ProcessViewType }

interface ProcessViewSelectorProps {
  view: ProcessViewType
  onChange: (view: ProcessViewType) => void
}

export function ProcessViewSelector({
  view,
  onChange,
}: ProcessViewSelectorProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (value) {
            onChange(value as ProcessViewType)
            localStorage.setItem('processView', value)
          }
        }}
      >
        {ENABLED_PROCESS_VIEW_TYPES.map((viewType) => {
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
                  aria-label={viewType.label}
                >
                  <Icon className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">{viewType.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </ToggleGroup>
    </TooltipProvider>
  )
}
