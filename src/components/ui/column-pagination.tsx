'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ColumnPaginationProps {
  currentPage: number // 1-based for display
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  /** The total is the node's capped 1001: `totalPages` is a lower limit and "last" is unknown. */
  capped?: boolean
  /** Defaults to `currentPage >= totalPages`; a capped list ends at a short page instead. */
  isLastPage?: boolean
  className?: string
  loading?: boolean
}

export function ColumnPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  capped = false,
  isLastPage = currentPage >= totalPages,
  className = '',
  loading = false,
}: ColumnPaginationProps) {
  const t = useTranslations()
  const [pageInput, setPageInput] = useState(() => currentPage.toString())
  // The box follows the page when something else moves it (a new search goes to page 1). Set
  // during render rather than in an effect, so no frame shows the old number.
  const [shownPage, setShownPage] = useState(currentPage)
  if (shownPage !== currentPage) {
    setShownPage(currentPage)
    setPageInput(currentPage.toString())
  }

  const goTo = (page: number) => {
    onPageChange(page)
    setPageInput(page.toString())
  }

  const handleInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10)
    if (pageNum >= 1 && (capped || pageNum <= totalPages)) {
      onPageChange(pageNum)
    } else {
      setPageInput(currentPage.toString())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit()
    }
    if (e.key === 'Escape') {
      setPageInput(currentPage.toString())
    }
  }

  // A page after the first keeps its controls even with no total (an error), so the user can go back.
  const showNavigation = totalPages > 1 || currentPage > 1

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 bg-muted/20',
        className
      )}
    >
      {showNavigation && (
        <>
          <Button
            variant="ghost"
            onClick={() => goTo(1)}
            disabled={currentPage <= 1 || loading}
            className="size-8 p-0"
            aria-label={t('pagination.first')}
            title={t('pagination.first')}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="size-8 p-0"
            aria-label={t('pagination.previous')}
            title={t('pagination.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </>
      )}

      <div className="flex items-center gap-1 text-xs">
        {showNavigation ? (
          <>
            <Input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handleInputSubmit}
              onKeyDown={handleKeyDown}
              className="h-8 w-20 text-center text-xs"
              type="number"
              min="1"
              max={capped ? undefined : totalPages}
              disabled={loading}
              aria-label={t('pagination.pageInput')}
              data-testid="column-page-input"
            />
            <span
              className="text-muted-foreground"
              data-testid="column-page-of"
            >
              {capped
                ? t('pagination.ofAtLeast', { count: totalPages })
                : t('pagination.of', { count: totalPages })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {t('pagination.items', { count: totalItems })}
          </span>
        )}

        {loading && (
          <div className="ml-1">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"></div>
          </div>
        )}
      </div>

      {showNavigation && (
        <>
          <Button
            variant="ghost"
            onClick={() => goTo(currentPage + 1)}
            disabled={isLastPage || loading}
            className="size-8 p-0"
            aria-label={t('pagination.next')}
            title={t('pagination.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* No "last" on a capped total: the node does not say which page that is. */}
          {!capped && (
            <Button
              variant="ghost"
              onClick={() => goTo(totalPages)}
              disabled={isLastPage || loading}
              className="size-8 p-0"
              aria-label={t('pagination.last')}
              title={t('pagination.last')}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}
