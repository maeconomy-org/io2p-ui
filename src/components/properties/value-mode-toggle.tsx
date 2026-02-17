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
 * Used by both PropertyField (RHF) and CollapsibleProperty (local state).
 */
export function ValueModeToggle({
  isFormulaMode,
  onTextMode,
  onFormulaMode,
  disabled = false,
}: ValueModeToggleProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center bg-muted rounded-md p-0.5 gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onTextMode}
              disabled={disabled}
              data-testid="value-mode-text"
              className={cn(
                'flex items-center justify-center rounded p-1.5 transition-colors',
                !isFormulaMode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed'
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
                'flex items-center justify-center rounded p-1.5 transition-colors',
                isFormulaMode
                  ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-700'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed'
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
