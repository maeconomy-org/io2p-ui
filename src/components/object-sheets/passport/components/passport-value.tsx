import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

import {
  getEnergyLabelClasses,
  getStatusBadgeClasses,
  isUrlValue,
  resolveColorSwatch,
  urlLinkLabel,
} from '../utils/passport-formatters'

interface PassportValueProps {
  propertyKey?: string
  displayValue: string
}

/**
 * Renders a property value with semantic decoration for the keys that benefit
 * from it: URLs become anchor tags, energy labels and statuses become colored
 * Badges, and color values get a swatch dot. Everything else renders as plain
 * text.
 */
export function PassportValue({
  propertyKey,
  displayValue,
}: PassportValueProps) {
  if (isUrlValue(propertyKey, displayValue)) {
    const linkText = urlLinkLabel(displayValue)
    return (
      <a
        href={displayValue}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline max-w-full"
        title={displayValue}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{linkText}</span>
      </a>
    )
  }
  if (propertyKey === 'energy-label') {
    const palette = getEnergyLabelClasses(displayValue)
    if (palette) {
      return (
        <Badge
          className={cn(
            'h-5 px-1.5 text-[11px] font-bold tracking-wider',
            palette
          )}
        >
          {displayValue}
        </Badge>
      )
    }
  }
  if (propertyKey === 'status') {
    return (
      <Badge
        className={cn(
          'h-5 px-1.5 text-[11px]',
          getStatusBadgeClasses(displayValue)
        )}
      >
        {displayValue}
      </Badge>
    )
  }
  if (propertyKey === 'color' || propertyKey === 'colour') {
    const swatch = resolveColorSwatch(displayValue)
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        {swatch && (
          <span
            className="inline-block h-3 w-3 rounded-full border border-border flex-shrink-0"
            style={{ backgroundColor: swatch }}
            aria-hidden="true"
          />
        )}
        <span>{displayValue}</span>
      </span>
    )
  }
  return <>{displayValue}</>
}
