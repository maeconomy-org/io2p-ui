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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_TABLE_PAGE_SIZE_OPTIONS } from '@/constants'

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
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
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
  onPageSizeChange,
  pageSizeOptions = DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
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
    return totalPages <= 5 ? totalPages : 5 // Show max 5 pages on mobile-first design
  }

  const maxPageNumbers = getMaxPageNumbers()

  return (
    <div className="flex flex-col gap-3 px-2 py-4">
      {/* Results info + rows per page */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {t('pagination.showing', {
            start: startItem,
            end: endItem,
            total: totalElements,
          })}
        </div>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">
              {t('pagination.rowsPerPage')}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
            className="size-9 p-0"
            title={t('pagination.first')}
          >
            <ChevronsLeft className="size-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstPage}
            className="size-9 p-0"
            title={t('pagination.previous')}
          >
            <ChevronLeft className="size-4" />
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
                        className="cursor-pointer size-9 p-0 text-xs sm:text-sm"
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
            className="size-9 p-0"
            title={t('pagination.next')}
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLast}
            disabled={isLastPage}
            className="size-9 p-0"
            title={t('pagination.last')}
          >
            <ChevronsRight className="size-4" />
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
