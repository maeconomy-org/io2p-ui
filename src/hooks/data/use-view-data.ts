'use client'

import { useState, useMemo, useEffect } from 'react'

import { useSearch } from '@/contexts'
import { usePagination, useAggregate } from '@/hooks'
import { ViewType } from '@/components/view-selector'

// Interface for table view data with internal data fetching
interface TableViewData {
  type: 'table'
  data: any[]
  loading: boolean // Initial loading (full screen)
  fetching: boolean // Pagination loading (internal)
  pagination: {
    currentPage: number
    totalPages: number
    totalElements: number
    pageSize: number
    isFirstPage: boolean
    isLastPage: boolean
    handlePageChange: (page: number) => void
    handleFirst: () => void
    handlePrevious: () => void
    handleNext: () => void
    handleLast: () => void
  }
}

// Interface for columns view data (simplified - no loadChildren)
interface ColumnsViewData {
  type: 'columns'
  rootObjects: any[]
  loading: boolean // Initial loading (full screen)
  fetching: boolean // Data refreshing (internal)
  rootPagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
}

// Union type for all view data
export type ViewData = TableViewData | ColumnsViewData

interface UseViewDataProps {
  viewType: ViewType
  // Performance options
  tablePageSize?: number
  columnsPageSize?: number
  // Filter options
  showDeleted?: boolean
}

/**
 * Data adapter hook that handles data fetching and provides view-specific data
 * Optimized for performance with big data sets
 */
export function useViewData({
  viewType,
  tablePageSize = 15, // Smaller for detailed table pagination
  columnsPageSize = 15, // Same as child pagination for consistency
  showDeleted = false, // Default to not showing deleted items
}: UseViewDataProps): ViewData {
  const { useAggregateEntities } = useAggregate()
  const { isSearchMode, searchViewResults, searchPagination } = useSearch()

  // Internal pagination state for table view
  const [currentPage, setCurrentPage] = useState(0)

  // Simple state for columns view (no more infinite scroll)
  const [columnsData, setColumnsData] = useState<any[]>([])

  // Determine page size based on view type
  const pageSize = viewType === 'table' ? tablePageSize : columnsPageSize

  // Fetch root objects with performance optimizations (for table view)
  const {
    data: aggregateResponse,
    isLoading,
    isFetching,
  } = useAggregateEntities(
    {
      page: currentPage,
      size: pageSize,
      // if we have only hasParentUUIDFilter then we are fetching root objects only no childrens if we add parentUUID then we are fetchins childrens only of this parent UUID if we skip both hasParentUUIDFilter and parentUUID then we are fetching all objects root and childrens together in one level
      hasParentUUIDFilter: true, // No parent UUID filter
      // Add softDeleted parameter for filtering deleted items
      searchBy: {
        isTemplate: false,
        ...(showDeleted ? {} : { softDeleted: false }),
      },
    },
    {
      enabled: !isSearchMode, // Fetch for both table and columns view when not in search mode
      staleTime: 30000, // Cache for 30 seconds
      keepPreviousData: true, // Smooth pagination transitions - keeps old data visible
      cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    }
  )

  // Extract and enhance data - use search results if in search mode
  const enhancedData = useMemo(() => {
    if (isSearchMode) {
      return searchViewResults // Already enhanced in search context
    }

    const allObjects = aggregateResponse?.content || []
    return allObjects.map((obj) => ({
      ...obj,
      hasChildren: obj.children && obj.children.length > 0,
      childCount: obj.children ? obj.children.length : 0,
    }))
  }, [aggregateResponse, isSearchMode, searchViewResults])

  // Pagination info - simplified for search mode
  const paginationInfo = useMemo(() => {
    if (isSearchMode) {
      // Search results are typically not paginated, show all results
      return {
        currentPage: 0,
        totalPages: 1,
        totalElements: searchViewResults.length,
        pageSize: searchViewResults.length || 1,
        isFirstPage: true,
        isLastPage: true,
      }
    }

    return {
      currentPage,
      totalPages: aggregateResponse?.totalPages || 0,
      totalElements: aggregateResponse?.totalElements || 0,
      pageSize,
      isFirstPage: aggregateResponse?.first ?? true,
      isLastPage: aggregateResponse?.last ?? true,
    }
  }, [
    aggregateResponse,
    currentPage,
    pageSize,
    isSearchMode,
    searchViewResults,
  ])

  // Create pagination handlers
  const paginationHandlers = usePagination({
    pagination: paginationInfo,
    onPageChange: setCurrentPage,
  })

  // For columns view, use enhanced data (from table view or search)
  useEffect(() => {
    if (viewType === 'columns') {
      setColumnsData(enhancedData)
    }
  }, [viewType, enhancedData])

  return useMemo(() => {
    if (viewType === 'table') {
      // Use search pagination when in search mode
      const paginationToUse =
        isSearchMode && searchPagination
          ? {
              currentPage: searchPagination.currentPage,
              totalPages: searchPagination.totalPages,
              totalElements: searchPagination.totalElements,
              pageSize: searchPagination.pageSize,
              isFirstPage: searchPagination.isFirstPage,
              isLastPage: searchPagination.isLastPage,
              handlePageChange: searchPagination.handlePageChange,
              handleFirst: searchPagination.handleFirst,
              handlePrevious: searchPagination.handlePrevious,
              handleNext: searchPagination.handleNext,
              handleLast: searchPagination.handleLast,
            }
          : {
              ...paginationInfo,
              ...paginationHandlers,
            }

      return {
        type: 'table',
        data: enhancedData,
        loading: isSearchMode ? false : isLoading, // No loading in search mode
        fetching: isSearchMode ? false : isFetching, // No fetching in search mode
        pagination: paginationToUse,
      }
    }

    if (viewType === 'columns') {
      const dataToUse = isSearchMode ? enhancedData : columnsData

      // Use search pagination for root when in search mode
      const rootPaginationToUse =
        isSearchMode && searchPagination
          ? {
              currentPage: searchPagination.currentPage + 1, // Convert to 1-based for UI
              totalPages: searchPagination.totalPages,
              totalItems: searchPagination.totalElements,
              onPageChange: searchPagination.handlePageChange, // Already handles 1-based conversion
            }
          : {
              currentPage: paginationInfo.currentPage + 1, // Convert to 1-based for UI
              totalPages: paginationInfo.totalPages,
              totalItems: paginationInfo.totalElements,
              onPageChange: (page: number) =>
                paginationHandlers.handlePageChange(page - 1), // Convert to 0-based for API
            }

      return {
        type: 'columns',
        rootObjects: dataToUse,
        loading: isSearchMode ? false : isLoading && columnsData.length === 0,
        fetching: isSearchMode ? false : isFetching,
        rootPagination: rootPaginationToUse,
      }
    }

    // Fallback to table
    const paginationToUse =
      isSearchMode && searchPagination
        ? {
            currentPage: searchPagination.currentPage,
            totalPages: searchPagination.totalPages,
            totalElements: searchPagination.totalElements,
            pageSize: searchPagination.pageSize,
            isFirstPage: searchPagination.isFirstPage,
            isLastPage: searchPagination.isLastPage,
            handlePageChange: searchPagination.handlePageChange,
            handleFirst: searchPagination.handleFirst,
            handlePrevious: searchPagination.handlePrevious,
            handleNext: searchPagination.handleNext,
            handleLast: searchPagination.handleLast,
          }
        : {
            ...paginationInfo,
            ...paginationHandlers,
          }

    return {
      type: 'table',
      data: enhancedData,
      loading: isSearchMode ? false : isLoading,
      fetching: isSearchMode ? false : isFetching,
      pagination: paginationToUse,
    }
  }, [
    viewType,
    enhancedData,
    isLoading,
    isFetching,
    paginationInfo,
    paginationHandlers,
    columnsData,
    isSearchMode,
    searchPagination, // Add search pagination to dependencies
  ])
}
