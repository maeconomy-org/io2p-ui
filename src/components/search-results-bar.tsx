'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Badge,
  Button,
  FloatingActionBar,
  FloatingActionBarSeparator,
} from '@/components/ui'
import { cn } from '@/lib/utils'

interface SearchResultsBarProps {
  /** The active query. Also gates the bar: an empty one hides it. */
  searchQuery: string
  resultsCount?: number
  onClearSearch: () => void
  /** True when a selection bar is also up, so this one clears it. */
  raised?: boolean
}

/**
 * What the list is currently filtered by, and the way out of it.
 *
 * FLOATING rather than inline, for the reason the selection bar already floats: an inline strip
 * appears the instant a search resolves and pushes the whole table down, moving the rows the user
 * was reading. This costs no layout at all, and stays reachable however far the results scroll.
 */
export function SearchResultsBar({
  searchQuery,
  resultsCount = 0,
  onClearSearch,
  raised = false,
}: SearchResultsBarProps) {
  const t = useTranslations()

  return (
    <FloatingActionBar
      open={!!searchQuery}
      label={t('objects.searchResults', { query: searchQuery })}
      level={raised ? 'raised' : 'base'}
      // Tinted so the bar does not blend into the white rows under it. The tint is a gradient over
      // `bg-card`, not a translucent colour, so the rows do not show through.
      className={cn(
        'border-[1.5px] border-primary/50 bg-[linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))]',
        'shadow-[0_12px_28px_-10px_hsl(var(--primary)/0.45)] ring-4 ring-primary/10'
      )}
      data-testid="search-results-bar"
    >
      <div className="flex min-w-0 items-center gap-2 px-1 sm:pl-2">
        <Search className="h-4 w-4 shrink-0 text-primary" />
        <span className="max-w-[12rem] truncate text-sm font-medium sm:max-w-xs">
          {searchQuery}
        </span>
        <Badge
          variant="secondary"
          className="shrink-0 whitespace-nowrap bg-primary/15 text-foreground hover:bg-primary/15"
          data-testid="search-results-count"
        >
          {t('objects.results', { count: resultsCount })}
        </Badge>
      </div>

      <FloatingActionBarSeparator />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 rounded-full"
        data-testid="search-clear"
        onClick={onClearSearch}
      >
        <X className="mr-1 h-4 w-4" />
        {t('objects.clearSearch')}
      </Button>
    </FloatingActionBar>
  )
}
