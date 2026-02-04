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
  className?: string
  loading?: boolean
}

export function ColumnPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  className = '',
  loading = false,
}: ColumnPaginationProps) {
  const t = useTranslations()
  const [pageInput, setPageInput] = useState(currentPage.toString())

  const handleInputChange = (value: string) => {
    setPageInput(value)
  }

  const handleInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10)
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum)
    } else {
      // Reset to current page if invalid
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

  // Always show info, but hide navigation buttons if only 1 page
  const showNavigation = totalPages > 1

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 bg-muted/20',
        className
      )}
    >
      {/* Show navigation buttons only if multiple pages */}
      {showNavigation && (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              onPageChange(1)
              setPageInput('1')
            }}
            disabled={currentPage <= 1 || loading}
            className="size-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onPageChange(currentPage - 1)
              setPageInput((currentPage - 1).toString())
            }}
            disabled={currentPage <= 1 || loading}
            className="size-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </>
      )}

      <div className="flex items-center gap-1 text-xs">
        {showNavigation ? (
          // Show full pagination input when multiple pages
          <>
            <Input
              value={pageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputSubmit}
              onKeyDown={handleKeyDown}
              className="h-8 w-20 text-center text-xs"
              type="number"
              min="1"
              max={totalPages}
              disabled={loading}
            />
            <span className="text-muted-foreground">
              {t('pagination.of', { count: totalPages })}
            </span>
          </>
        ) : (
          // Show simple page info when only 1 page
          <span className="text-muted-foreground">
            {t('pagination.items', { count: totalItems })}
          </span>
        )}

        {loading && (
          <div className="ml-1">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Show navigation buttons only if multiple pages */}
      {showNavigation && (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              onPageChange(currentPage + 1)
              setPageInput((currentPage + 1).toString())
            }}
            disabled={currentPage >= totalPages || loading}
            className="size-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onPageChange(totalPages)
              setPageInput(totalPages.toString())
            }}
            disabled={currentPage >= totalPages || loading}
            className="size-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
