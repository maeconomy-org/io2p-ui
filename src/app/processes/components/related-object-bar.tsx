'use client'

import { useTranslations } from 'next-intl'
import { Package, X } from 'lucide-react'

import {
  Button,
  FloatingActionBar,
  FloatingActionBarSeparator,
  type FloatingActionBarLevel,
} from '@/components/ui'
import { useObjects } from '@/hooks/api/entities'

/**
 * States that the list is narrowed to one object's relations, and offers the way out.
 *
 * Floats, like every other "what this list is filtered by" bar. An inline strip read as page chrome
 * rather than as a dismissible filter, and it ate a row of height above a chart that wants all of
 * it — which matters here because this bar is up for the whole visit, not for a moment.
 */
export function RelatedObjectBar({
  objectId,
  onClear,
  level,
}: {
  objectId: string
  onClear: () => void
  /** Which slot in the floating stack — the caller knows which other bars are up. */
  level: FloatingActionBarLevel
}) {
  const t = useTranslations()

  // `enrichFiles: false` — a name is all this needs, and it matches how `useRefName` resolves one.
  // NOT a hit on the cache the object's sheet filled: both options are part of the detail key, and
  // the sheet reads `{enrichFiles: true, includeDeleted: true}`. This is deliberately its own,
  // lighter read rather than pulling an enriched aggregate to print one string.
  const { data } = useObjects().useGet(objectId, { enrichFiles: false })

  // The id, not a blank: an unresolved object is still the real filter, and showing nothing would
  // read as "not filtered" while the list stays narrowed.
  const name = data?.name ?? objectId

  return (
    <FloatingActionBar
      open
      label={t('processes.relatedTo', { name })}
      level={level}
      data-testid="related-object-bar"
    >
      <div className="flex min-w-0 items-center gap-2 px-1 sm:pl-2">
        <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="max-w-[12rem] truncate text-sm font-medium sm:max-w-xs">
          {name}
        </span>
      </div>

      <FloatingActionBarSeparator />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 rounded-full"
        data-testid="related-object-clear"
        onClick={onClear}
      >
        <X className="mr-1 h-4 w-4" />
        {t('processes.clearRelated')}
      </Button>
    </FloatingActionBar>
  )
}
