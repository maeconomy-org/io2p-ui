'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

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
  className,
}: {
  pages: readonly (FetchedPage | undefined)[]
  className?: string
}) {
  const t = useTranslations()
  const loaded = pages.filter((p): p is FetchedPage => !!p)
  const shown = loaded.reduce((sum, p) => sum + p.data.length, 0)
  const total = loaded.reduce((sum, p) => sum + p.page.totalElements, 0)
  if (total <= shown) return null

  return (
    <p
      className={cn(
        'border-t px-3 py-2 text-xs text-muted-foreground',
        className
      )}
      data-testid="command-more"
    >
      {t('common.pickerMore', { shown, total })}
    </p>
  )
}
