'use client'

import { FunctionSquare, Type } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'

interface ValueModeToggleProps {
  isFormulaMode: boolean
  onTextMode: () => void
  onFormulaMode: () => void
  disabled?: boolean
}

/**
 * Compact icon-only toggle for switching between text and formula mode.
 * Styled to match the property view toggle (border group pattern).
 */
export function ValueModeToggle({
  isFormulaMode,
  onTextMode,
  onFormulaMode,
  disabled = false,
}: ValueModeToggleProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center border rounded-md overflow-hidden',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onTextMode}
              disabled={disabled}
              data-testid="value-mode-text"
              className={cn(
                'p-1 transition-colors',
                !isFormulaMode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <Type className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Text
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onFormulaMode}
              disabled={disabled}
              data-testid="value-mode-formula"
              className={cn(
                'p-1 transition-colors',
                isFormulaMode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              <FunctionSquare className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Formula
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
