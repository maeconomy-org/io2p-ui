'use client'

import { useTranslations } from 'next-intl'

import { MAX_SEARCH_WORDS, MIN_SEARCH_CHARS } from '@/constants'
import { type SearchKind, searchInput } from '@/lib/search-text'
import { cn } from '@/lib/utils'

/**
 * Says why the typed text does not search: one letter still shows the whole list, more than
 * `MAX_SEARCH_WORDS` words keep the last search. `id` is for the input's `aria-describedby`.
 */
export function SearchMinHint({
  query,
  kind,
  id,
}: {
  query: string
  kind: SearchKind
  id?: string
}) {
  const t = useTranslations('search')
  const input = searchInput(query, kind)
  const text =
    input.status !== 'refused'
      ? null
      : input.problem === 'too-many-words'
        ? t('maxWords', { count: MAX_SEARCH_WORDS })
        : kind === 'words'
          ? t('minWordChars', { count: MIN_SEARCH_CHARS })
          : t('minChars', { count: MIN_SEARCH_CHARS })

  // The live region stays mounted: a screen reader misses one that appears with its text. A picker
  // that reopens with the text already there is covered by the input's `aria-describedby`, read
  // when the input takes focus; keep both.
  return (
    <p
      id={id}
      role="status"
      data-testid="search-min-hint"
      className={cn(
        'text-xs text-muted-foreground',
        text && 'border-b px-3 py-1.5'
      )}
    >
      {text}
    </p>
  )
}
