'use client'

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'

interface TablePaginationProps {
  currentPage: number // 0-based
  totalPages: number
  totalElements: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
  onPageChange: (page: number) => void
  onFirst: () => void
  onPrevious: () => void
  onNext: () => void
  onLast: () => void
}

export function TablePagination({
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  isFirstPage,
  isLastPage,
  onPageChange,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: TablePaginationProps) {
  const t = useTranslations()
  if (totalPages <= 1) {
    return null
  }

  // Calculate display info
  const startItem = currentPage * pageSize + 1
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements)

  // Determine max page numbers to show based on screen size
  const getMaxPageNumbers = () => {
    // On mobile (< 640px), show fewer page numbers to prevent overflow
    // This is handled by CSS classes but we also limit the logic here
    return totalPages <= 3 ? totalPages : 3 // Show max 3 pages on mobile-first design
  }

  const maxPageNumbers = getMaxPageNumbers()

  return (
    <div className="flex flex-col gap-3 px-2 py-4">
      {/* Results info - always visible on top on mobile */}
      <div className="text-sm text-muted-foreground text-center sm:text-left">
        {t('pagination.showing', {
          start: startItem,
          end: endItem,
          total: totalElements,
        })}
      </div>

      {/* Main pagination controls */}
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {/* First and Previous buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onFirst}
            disabled={isFirstPage}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0"
            title={t('pagination.first')}
          >
            <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={isFirstPage}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0"
            title={t('pagination.previous')}
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Page numbers - responsive design */}
        <div className="flex items-center">
          <Pagination>
            <PaginationContent className="gap-1">
              {Array.from(
                { length: Math.min(totalPages, maxPageNumbers) },
                (_, i) => {
                  let pageNum: number

                  if (totalPages <= maxPageNumbers) {
                    // Show all pages if within limit
                    pageNum = i
                  } else if (currentPage <= 1) {
                    // Show first pages
                    pageNum = i
                  } else if (currentPage >= totalPages - 2) {
                    // Show last pages
                    pageNum = totalPages - maxPageNumbers + i
                  } else {
                    // Show pages around current page
                    pageNum = currentPage - 1 + i
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => onPageChange(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10 p-0 text-xs sm:text-sm"
                      >
                        {pageNum + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )
                }
              )}
            </PaginationContent>
          </Pagination>
        </div>

        {/* Next and Last buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={isLastPage}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0"
            title={t('pagination.next')}
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLast}
            disabled={isLastPage}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0"
            title={t('pagination.last')}
          >
            <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Page info - more compact on mobile */}
      <div className="text-xs sm:text-sm text-muted-foreground text-center">
        {t('pagination.pageOf', {
          page: currentPage + 1,
          pages: totalPages,
        })}
      </div>
    </div>
  )
}
