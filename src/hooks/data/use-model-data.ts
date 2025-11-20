'use client'

import { useState, useMemo } from 'react'

import { useAggregate, usePagination } from '@/hooks'

interface UseModelDataProps {
  pageSize?: number
  showDeleted?: boolean
}

/**
 * Hook for managing model (object model) data with pagination and filtering
 */
export function useModelData({
  showDeleted = false,
  pageSize = 15,
}: UseModelDataProps = {}) {
  const { useModelEntities } = useAggregate()
  const [currentPage, setCurrentPage] = useState(0)

  // Fetch template entities with pagination
  const {
    data: modelResponse,
    isLoading,
    isFetching,
  } = useModelEntities(
    {
      page: currentPage,
      size: pageSize,
      ...(showDeleted ? {} : { searchBy: { softDeleted: false } }),
    },
    {
      staleTime: 30000, // Cache for 30 seconds
      keepPreviousData: true, // Smooth pagination transitions
      cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    }
  )

  // Pagination info
  const paginationInfo = useMemo(() => {
    return {
      currentPage,
      totalPages: modelResponse?.totalPages || 0,
      totalElements: modelResponse?.totalElements || 0,
      pageSize,
      isFirstPage: modelResponse?.first ?? true,
      isLastPage: modelResponse?.last ?? true,
    }
  }, [modelResponse, currentPage, pageSize])

  // Create pagination handlers
  const paginationHandlers = usePagination({
    pagination: paginationInfo,
    onPageChange: setCurrentPage,
  })

  return {
    data: modelResponse?.content || [],
    loading: isLoading,
    fetching: isFetching,
    pagination: {
      ...paginationInfo,
      ...paginationHandlers,
    },
  }
}
