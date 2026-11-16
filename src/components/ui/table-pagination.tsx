'use client'

import { useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

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
import { useFormatTotal } from '@/hooks/ui/use-format-total'

interface TablePaginationProps {
  currentPage: number // 0-based
  totalPages: number
  totalElements: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
  /** The total is the node's capped 1001: `totalPages` is a lower limit and "last" is unknown. */
  capped?: boolean
  /** Rows on this page; the range ends there rather than at the (possibly capped) total. */
  rowsOnPage?: number
  onPageChange: (page: number) => void
  onFirst: () => void
  onPrevious: () => void
  onNext: () => void
  onLast: () => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

const MAX_PAGE_NUMBERS = 5

export function TablePagination({
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  isFirstPage,
  isLastPage,
  capped = false,
  rowsOnPage,
  onPageChange,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
}: TablePaginationProps) {
  const t = useTranslations()
  const format = useFormatter()
  const total = useFormatTotal()
  const previousRef = useRef<HTMLButtonElement>(null)
  const movedByNext = useRef(false)

  // A disabled button drops focus to <body>: when "next" reached the end, keep the keyboard user
  // on "previous" instead.
  useEffect(() => {
    if (isLastPage && movedByNext.current) previousRef.current?.focus()
    movedByNext.current = false
  }, [isLastPage, currentPage])

  // The pages the user can reach: past a capped total that is the next one; past an exact total
  // that shrank, the page they are on still has to show.
  const knownPages = Math.max(
    capped ? currentPage + (isLastPage ? 1 : 2) : totalPages,
    currentPage + 1
  )
  if (knownPages <= 1) {
    return null
  }

  const rows =
    rowsOnPage ??
    Math.max(0, Math.min(pageSize, totalElements - currentPage * pageSize))
  const startItem = currentPage * pageSize + 1
  const endItem = startItem + rows - 1
  const maxPageNumbers = Math.min(knownPages, MAX_PAGE_NUMBERS)

  const pageLine = !capped
    ? t('pagination.pageOf', { page: currentPage + 1, pages: totalPages })
    : currentPage + 1 > totalPages
      ? t('pagination.pageOnly', { page: currentPage + 1 })
      : t('pagination.pageOfAtLeast', {
          page: currentPage + 1,
          pages: totalPages,
        })

  return (
    <div className="flex flex-col gap-3 px-2 py-4">
      {/* Results info + rows per page */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-sm text-muted-foreground"
          data-testid="page-indicator"
        >
          {rows > 0 &&
            t('pagination.showing', {
              start: format.number(startItem),
              end: format.number(endItem),
              total: total.text(totalElements, capped),
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
              <SelectTrigger className="h-8 w-[70px]" data-testid="page-size">
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
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onFirst}
            disabled={isFirstPage}
            className="size-9 p-0"
            title={t('pagination.first')}
            aria-label={t('pagination.first')}
            data-testid="page-first"
          >
            <ChevronsLeft className="size-4" />
          </Button>

          <Button
            ref={previousRef}
            size="sm"
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstPage}
            className="size-9 p-0"
            title={t('pagination.previous')}
            aria-label={t('pagination.previous')}
            data-testid="page-prev"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <div className="flex items-center">
          <Pagination>
            <PaginationContent className="gap-1">
              {Array.from({ length: maxPageNumbers }, (_, i) => {
                let pageNum: number

                if (knownPages <= maxPageNumbers) {
                  pageNum = i
                } else if (currentPage <= 1) {
                  pageNum = i
                } else if (currentPage >= knownPages - 2) {
                  pageNum = knownPages - maxPageNumbers + i
                } else {
                  pageNum = currentPage - 1 + i
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => onPageChange(pageNum)}
                      isActive={currentPage === pageNum}
                      data-testid={`page-number-${pageNum + 1}`}
                      className="cursor-pointer size-9 p-0 text-xs sm:text-sm"
                    >
                      {pageNum + 1}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
            </PaginationContent>
          </Pagination>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              movedByNext.current = true
              onNext()
            }}
            disabled={isLastPage}
            className="size-9 p-0"
            title={t('pagination.next')}
            aria-label={t('pagination.next')}
            data-testid="page-next"
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* No "last" on a capped total: the node does not say which page that is. */}
          {!capped && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLast}
              disabled={isLastPage}
              className="size-9 p-0"
              title={t('pagination.last')}
              aria-label={t('pagination.last')}
              data-testid="page-last"
            >
              <ChevronsRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="text-xs sm:text-sm text-muted-foreground text-center"
        role="status"
        aria-live="polite"
        data-testid="page-of"
      >
        {pageLine}
      </div>
    </div>
  )
}
