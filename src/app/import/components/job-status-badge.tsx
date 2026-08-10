'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

import type { ImportJobStatus } from '../types'

const STATUS_DOT: Record<ImportJobStatus, string> = {
  draft: 'bg-muted-foreground/50',
  queued: 'bg-muted-foreground',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-emerald-500',
  completed_with_errors: 'bg-amber-500',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground/50',
}

export function JobStatusBadge({ status }: { status: ImportJobStatus }) {
  const t = useTranslations()
  return (
    <Badge
      variant="outline"
      data-testid="job-status"
      data-status={status}
      className="gap-1.5 font-normal"
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
        aria-hidden
      />
      {t(`import.status.${status}`)}
    </Badge>
  )
}
