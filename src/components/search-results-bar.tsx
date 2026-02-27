'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge, Button } from '@/components/ui'

interface SearchPagination {
  totalElements: number
  currentPage: number
  totalPages: number
}

interface SearchResultsBarProps {
  /** The search query string */
  searchQuery: string
  /** Number of results (for non-paginated view) */
  resultsCount?: number
  /** Pagination info (for paginated view) */
  pagination?: SearchPagination
  /** Callback when clear search is clicked */
  onClearSearch: () => void
  /** Optional className */
  className?: string
}

/**
 * Search results information bar.
 * Shows search query, result count/pagination, and clear button.
 */
export function SearchResultsBar({
  searchQuery,
  resultsCount = 0,
  pagination,
  onClearSearch,
  className,
}: SearchResultsBarProps) {
  const t = useTranslations()

  return (
    <div
      className={`mb-4 p-3 bg-muted/50 border border-border rounded-lg ${className || ''}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {t('objects.searchResults', { query: searchQuery })}
            </span>
          </div>
          <Badge variant="secondary" className="whitespace-nowrap">
            {pagination
              ? t('objects.resultsPage', {
                  count: pagination.totalElements,
                  page: pagination.currentPage + 1,
                  pages: pagination.totalPages,
                })
              : t('objects.results', {
                  count: resultsCount,
                })}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSearch}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4 mr-1" />
          {t('objects.clearSearch')}
        </Button>
      </div>
    </div>
  )
}
