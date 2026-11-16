'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * "—" for a count the node did not read in time. A button so the keyboard can open its tooltip;
 * the clicks stop here so a row behind it does not open.
 */
export function CountUnavailable({ label }: { label: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="count-unavailable"
            className="rounded-sm px-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden="true">—</span>
            <span className="sr-only">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
