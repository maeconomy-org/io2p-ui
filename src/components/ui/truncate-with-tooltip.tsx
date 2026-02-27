'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TruncateWithTooltipProps {
  text: string
  maxLength: number
  className?: string
}

/**
 * Truncates text with ellipsis and shows full text in tooltip on hover.
 */
export function TruncateWithTooltip({
  text,
  maxLength,
  className,
}: TruncateWithTooltipProps) {
  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate ? text.slice(0, maxLength) + '...' : text

  if (!shouldTruncate) {
    return <span className={className}>{displayText}</span>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{displayText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
