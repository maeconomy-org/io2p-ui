'use client'

import { useTranslations } from 'next-intl'
import { Package, X } from 'lucide-react'

import { useObjects } from '@/hooks/api/entities'

/**
 * States that the table is narrowed to one object's relations, and offers the way out.
 *
 * Sits in the toolbar beside Filters, not in a floating bar: the floating slot belongs to the
 * selection actions alone, and two floating bars stacked on top of each other read as clutter.
 * Table view only — the chart views show the same object ticked in their object filter.
 */
export function RelatedObjectChip({
  objectId,
  onClear,
}: {
  objectId: string
  onClear: () => void
}) {
  const t = useTranslations()

  // `enrichFiles: false` — a name is all this needs, and it matches how `useRefName` resolves one.
  // NOT a hit on the cache the object's sheet filled: both options are part of the detail key, and
  // the sheet reads `{enrichFiles: true, includeDeleted: true}`.
  const { data } = useObjects().useGet(objectId, { enrichFiles: false })

  // The id, not a blank: an unresolved object is still the real filter, and showing nothing would
  // read as "not filtered" while the list stays narrowed.
  const name = data?.name ?? objectId

  return (
    <div
      data-testid="related-object-chip"
      className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-primary/35 bg-primary/[0.07] pl-3 pr-1 text-sm"
    >
      <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 max-w-[12rem] truncate sm:max-w-xs">
        {t('processes.relatedTo', { name })}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={t('processes.clearRelated')}
        data-testid="related-object-clear"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
