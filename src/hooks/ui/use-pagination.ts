'use client'

import { useCallback } from 'react'

interface PaginationData {
  currentPage: number // 0-based
  totalPages: number
  totalElements: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
}

interface UsePaginationProps {
  pagination: PaginationData
  onPageChange: (page: number) => void
}

interface UsePaginationReturn extends PaginationData {
  // Simplified handlers
  handlePageChange: (page: number) => void
  handleFirst: () => void
  handlePrevious: () => void
  handleNext: () => void
  handleLast: () => void
}

/**
 * Hook that manages pagination logic and provides clean handlers
 * Removes the need for multiple handler functions in parent components
 */
export function usePagination({
  pagination,
  onPageChange,
}: UsePaginationProps): UsePaginationReturn {
  const {
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    isFirstPage,
    isLastPage,
  } = pagination

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        onPageChange(page)
      }
    },
    [onPageChange, totalPages]
  )

  const handleFirst = useCallback(() => {
    if (!isFirstPage) {
      onPageChange(0)
    }
  }, [onPageChange, isFirstPage])

  const handlePrevious = useCallback(() => {
    if (!isFirstPage) {
      onPageChange(currentPage - 1)
    }
  }, [onPageChange, currentPage, isFirstPage])

  const handleNext = useCallback(() => {
    if (!isLastPage) {
      onPageChange(currentPage + 1)
    }
  }, [onPageChange, currentPage, isLastPage])

  const handleLast = useCallback(() => {
    if (!isLastPage) {
      onPageChange(totalPages - 1)
    }
  }, [onPageChange, totalPages, isLastPage])

  return {
    // Pagination data
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    isFirstPage,
    isLastPage,
    // Clean handlers
    handlePageChange,
    handleFirst,
    handlePrevious,
    handleNext,
    handleLast,
  }
}
