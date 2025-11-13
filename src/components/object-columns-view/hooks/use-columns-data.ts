'use client'

import { useState, useEffect } from 'react'
import { useUnifiedDelete } from '@/hooks'

import { useColumnPagination } from './use-column-pagination'
import { useColumnSelection } from './use-column-selection'
import { useColumnSearch } from './use-column-search'

interface UseColumnsDataProps {
  data: any[]
  loadChildren?: (
    parentUUID: string,
    page?: number,
    searchTerm?: string
  ) => Promise<{ items: any[]; totalPages: number; totalItems: number }>
  rootPagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  fetching?: boolean
}

export function useColumnsData({
  data,
  loadChildren,
  rootPagination,
  fetching = false,
}: UseColumnsDataProps) {
  // Column management hooks
  const {
    columnPagination,
    handleColumnPageChange,
    setPaginationForColumn,
    removePaginationForColumn,
    clearAllPagination,
    getPaginationForColumn,
    isColumnLoading,
  } = useColumnPagination({ loadChildren })

  const {
    columns,
    selectedIds,
    path,
    handleSelectItem,
    updateColumnData,
    initializeWithData,
  } = useColumnSelection({
    loadChildren,
    onPaginationSet: setPaginationForColumn,
    onPaginationRemove: removePaginationForColumn,
    onLoadingSet: (columnIndex: number, loading: boolean) => {
      // This will be handled by the pagination hook
    },
  })

  // Delete functionality
  const {
    isDeleteModalOpen,
    objectToDelete,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useUnifiedDelete()

  // Server-side column search with debouncing (only if loadChildren is available)
  const searchEnabled = !!loadChildren
  const {
    columnSearchTerms = {},
    handleColumnSearchChange: handleSearchChange = () => {},
    isColumnSearching = () => false,
    getColumnSearchTerm = () => '',
  } = searchEnabled
    ? useColumnSearch({
        loadChildren: loadChildren!,
        onDataUpdate: updateColumnData,
        onPaginationUpdate: setPaginationForColumn,
      })
    : {}

  // Fallback client-side search state for root column
  const [rootSearchTerm, setRootSearchTerm] = useState('')

  // Calculate root column pagination based on filtered results
  const getRootColumnPagination = () => {
    if (!rootPagination) return null

    const rootItems = columns[0] || []
    const filteredCount = rootSearchTerm
      ? rootItems.filter((item: any) => {
          const searchLower = rootSearchTerm.toLowerCase()
          return (
            item.name?.toLowerCase().includes(searchLower) ||
            item.description?.toLowerCase().includes(searchLower) ||
            item.uuid?.toLowerCase().includes(searchLower)
          )
        }).length
      : rootItems.length

    // When searching, show filtered results pagination
    if (rootSearchTerm) {
      return {
        currentPage: 1,
        totalPages: 1,
        totalItems: filteredCount,
        onPageChange: () => {}, // No pagination for filtered client-side results
      }
    }

    // Normal pagination
    return rootPagination
  }

  // Wrapper to handle search with parent context
  const handleColumnSearchChange = (
    columnIndex: number,
    searchTerm: string
  ) => {
    if (columnIndex === 0) {
      // Root column uses client-side search for now
      setRootSearchTerm(searchTerm)
    } else {
      // Child columns use server-side search
      const parentItem = path[columnIndex - 1]
      if (parentItem && searchEnabled) {
        handleSearchChange(columnIndex, searchTerm, parentItem.uuid)
      }
    }
  }

  // Get search term for a column
  const getSearchTermForColumn = (columnIndex: number) => {
    if (columnIndex === 0) {
      return rootSearchTerm
    }
    return searchEnabled ? getColumnSearchTerm(columnIndex) : ''
  }

  // Check if a column is loading/searching
  const isColumnLoadingOrSearching = (columnIndex: number) => {
    if (columnIndex === 0) {
      return fetching
    }
    return (
      isColumnLoading(columnIndex) ||
      (searchEnabled && isColumnSearching(columnIndex))
    )
  }

  // Create a wrapper for column page change that provides the correct parent UUID
  const handleColumnPageChangeWrapper = async (
    columnIndex: number,
    newPage: number
  ) => {
    const parentItem = path[columnIndex - 1]
    if (parentItem) {
      await handleColumnPageChange(
        columnIndex,
        newPage,
        parentItem.uuid,
        updateColumnData
      )
    }
  }

  // Update root column when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      initializeWithData(data)
      clearAllPagination()
    }
  }, [data]) // Only depend on data, not the functions

  return {
    // Column data
    columns,
    selectedIds,
    path,

    // Column operations
    handleSelectItem,
    updateColumnData,
    initializeWithData,

    // Pagination
    getPaginationForColumn,
    getRootColumnPagination,
    handleColumnPageChangeWrapper,
    isColumnLoadingOrSearching,

    // Search
    handleColumnSearchChange,
    getSearchTermForColumn,

    // Delete
    isDeleteModalOpen,
    objectToDelete,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  }
}
