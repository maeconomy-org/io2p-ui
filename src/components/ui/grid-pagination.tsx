'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

interface GridPaginationProps {
  currentPage: number
  totalPages: number
  totalElements: number
  pageSize: number
  isFetching?: boolean
  onPageChange: (page: number) => void
}

export function GridPagination({
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  isFetching = false,
  onPageChange,
}: GridPaginationProps) {
  const t = useTranslations()

  if (totalPages <= 1) return null

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalElements)

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {t('pagination.showing', {
          start: startIndex + 1,
          end: endIndex,
          total: totalElements,
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isFetching}
        >
          {t('pagination.previous')}
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (pageNum) => (
              <Button
                key={pageNum}
                type="button"
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                disabled={isFetching}
                className="w-8 h-8 p-0"
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            )
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isFetching}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  )
}
