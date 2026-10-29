'use client'

import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { searchApplies, type ListSearch } from './search-parser'

/**
 * Names the search filters a list did not apply. Without it a list that cannot filter by a token
 * shows every row, which reads as "these all match".
 */
export function SearchFilterNote({ search }: { search: ListSearch | null }) {
  const t = useTranslations()
  if (!search) return null
  const { unsupported, invalid } = search
  if (unsupported.length === 0 && invalid.length === 0) return null

  const tokens = (filters: ListSearch['unsupported']) =>
    filters.map((f) => f.raw).join(', ')

  return (
    <div
      role="status"
      data-testid="search-filter-note"
      className="mb-3 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {unsupported.length > 0 && (
          <p>{t('search.notApplied', { filters: tokens(unsupported) })}</p>
        )}
        {invalid.length > 0 && (
          <p>{t('search.invalidFilter', { filters: tokens(invalid) })}</p>
        )}
        {searchApplies(search) && <p>{t('search.restApplies')}</p>}
      </div>
    </div>
  )
}
