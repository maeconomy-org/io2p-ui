'use client'

import { useTranslations } from 'next-intl'
import { ChevronsDownUp } from 'lucide-react'

import { Button } from '@/components/ui'

/** Closes every open section under the list it heads — properties, formulas, files, totals, flows. */
export function CollapseAllButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground"
      onClick={onClick}
      aria-label={t('objects.properties.collapseAll')}
      title={t('objects.properties.collapseAll')}
      data-testid="collapse-all"
    >
      <ChevronsDownUp className="h-4 w-4" />
    </Button>
  )
}
