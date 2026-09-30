'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronsDownUp } from 'lucide-react'

import { Button } from '@/components/ui'

import { MarksLegend } from './marks-legend'

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

/**
 * The toolbar over a list of things that open: an optional heading on the left, then Collapse all
 * (left out where nothing opens, as in the grid), the marks legend, and anything else, such as the
 * view toggle.
 */
export function ListToolbar({
  heading,
  onCollapse,
  children,
}: {
  heading?: ReactNode
  onCollapse?: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {heading && <div className="mr-auto">{heading}</div>}
      {onCollapse && <CollapseAllButton onClick={onCollapse} />}
      <MarksLegend />
      {children}
    </div>
  )
}
