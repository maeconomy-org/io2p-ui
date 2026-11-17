'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useFormatTotal } from '@/hooks/ui/use-format-total'
import { CAPPED_TOTAL, isCappedTotal } from '@/lib/list-total'

/** One fetched page of a list, as every node list returns it. */
export interface FetchedPage {
  data: readonly unknown[]
  page: { totalElements: number }
}

/**
 * Footer for a type-to-search picker whose pages are cut: says how much exists and how to reach it.
 *
 * Without it a picker that fetched the first `SEARCH_SIZE` rows looks complete, and an item that
 * did not make the page looks like it does not exist. It counts what was FETCHED, not what is
 * rendered — a picker that hides some rows (self, already picked) still holds the first N results,
 * and counting only the visible ones would understate it. A picker merging several types passes
 * one page per type.
 */
export function CommandMore({
  pages,
  capped = false,
  className,
}: {
  pages: readonly (FetchedPage | undefined)[]
  /** The pages come from lists the node caps at 1001: see `isCappedTotal`. */
  capped?: boolean
  className?: string
}) {
  const t = useTranslations()
  const formatTotal = useFormatTotal()
  const loaded = pages.filter((p): p is FetchedPage => !!p)
  const shown = loaded.reduce((sum, p) => sum + p.data.length, 0)
  const total = loaded.reduce((sum, p) => sum + p.page.totalElements, 0)
  if (total <= shown) return null
  // A capped page makes the sum a lower limit, so no exact number is shown.
  const anyCapped = loaded.some((p) =>
    isCappedTotal(p.page.totalElements, capped)
  )

  return (
    <p
      className={cn(
        'border-t px-3 py-2 text-xs text-muted-foreground',
        className
      )}
      data-testid="command-more"
    >
      {t('common.pickerMore', {
        shown,
        total: anyCapped
          ? formatTotal.text(CAPPED_TOTAL, true)
          : formatTotal.text(total, false),
      })}
    </p>
  )
}
