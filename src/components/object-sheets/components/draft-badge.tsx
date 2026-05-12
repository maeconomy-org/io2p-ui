'use client'

import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

interface DraftBadgeProps {
  className?: string
}

export function DraftBadge({ className }: DraftBadgeProps) {
  const t = useTranslations()
  return (
    <Badge
      variant="secondary"
      className={cn('text-[10px] uppercase', className)}
    >
      {t('objects.drafts.badge')}
    </Badge>
  )
}
