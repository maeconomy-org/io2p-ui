'use client'

import { useTranslations } from 'next-intl'

import { MIN_SEARCH_CHARS } from '@/constants'
import { searchText } from '@/lib/search-text'
import { cn } from '@/lib/utils'

/** Says why one typed letter still shows the whole list. For a picker the node filters. */
export function SearchMinHint({ query }: { query: string }) {
  const t = useTranslations('search')
  const tooShort = query.trim() !== '' && searchText(query) === undefined

  // The live region stays mounted: a screen reader misses one that appears with its text.
  return (
    <p
      role="status"
      data-testid="search-min-hint"
      className={cn(
        'text-xs text-muted-foreground',
        tooShort && 'border-b px-3 py-1.5'
      )}
    >
      {tooShort ? t('minChars', { count: MIN_SEARCH_CHARS }) : null}
    </p>
  )
}
