'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FunctionSquare, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

interface FormulaDisplayProps {
  formula: string
  resolvedExpression?: string
  result: string | number | null
  variableMapping?: Record<
    string,
    { propertyKey: string; resolvedValue?: number | null }
  >
  className?: string
  compact?: boolean
}

/**
 * Read-only display for a formula property result.
 * Shows the computed result with an expandable formula details section.
 */
export function FormulaDisplay({
  formula,
  resolvedExpression,
  result,
  variableMapping,
  className,
  compact = false,
}: FormulaDisplayProps) {
  const t = useTranslations()
  const [isExpanded, setIsExpanded] = useState(false)

  const displayResult =
    result !== null && result !== undefined ? String(result) : '—'

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Badge
          variant="secondary"
          className="h-4 px-1 text-[10px] gap-0.5 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        >
          <FunctionSquare className="h-2.5 w-2.5" />
          fx
        </Badge>
        <span className="text-sm font-medium">{displayResult}</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[10px] gap-0.5 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        >
          <FunctionSquare className="h-3 w-3" />
          {t('objects.properties.formulaType')}
        </Badge>
        <span className="text-sm font-bold">{displayResult}</span>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="pl-2 border-l-2 border-violet-200 dark:border-violet-800 space-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">
              {t('objects.properties.formula')}:
            </span>{' '}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">
              {formula}
            </code>
          </div>
          {resolvedExpression && resolvedExpression !== formula && (
            <div>
              <span className="font-medium">
                {t('objects.properties.formulaResolved')}:
              </span>{' '}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">
                {resolvedExpression}
              </code>
            </div>
          )}
          {variableMapping && Object.keys(variableMapping).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(variableMapping).map(([varName, mapping]) => (
                <Badge
                  key={varName}
                  variant="outline"
                  className="text-[10px] font-mono"
                >
                  {varName} = {mapping.propertyKey}
                  {mapping.resolvedValue !== null &&
                    mapping.resolvedValue !== undefined &&
                    ` (${mapping.resolvedValue})`}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
