import { Package } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LifecycleStatProps {
  icon: typeof Package
  label: string
  value: string
  highlight?: boolean
  testId?: string
}

/** Single tile inside the lifecycle ribbon (icon + label + value). */
export function LifecycleStat({
  icon: Icon,
  label,
  value,
  highlight,
  testId,
}: LifecycleStatProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5',
        highlight && 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
      )}
      data-testid={testId}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
          {label}
        </div>
        <div className="text-sm font-medium truncate leading-snug">{value}</div>
      </div>
    </div>
  )
}
