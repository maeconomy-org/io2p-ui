'use client'

import { useState } from 'react'

import { logger } from '@/lib'

interface UseColumnPaginationProps {
  loadChildren?: (
    parentUUID: string,
    page?: number,
    searchTerm?: string,
    showDeleted?: boolean
  ) => Promise<{ items: any[]; totalPages: number; totalItems: number }>
  showDeleted?: boolean
}

export function useColumnPagination({
  loadChildren,
  showDeleted = false,
}: UseColumnPaginationProps) {
  // Pagination state for each column (columnIndex -> { currentPage, totalPages, totalItems })
  const [columnPagination, setColumnPagination] = useState<
    Map<
      number,
      {
        currentPage: number
        totalPages: number
        totalItems: number
      }
    >
  >(new Map())

  const [loadingColumns, setLoadingColumns] = useState<Set<number>>(new Set())

  // Handle page change for a specific column
  const handleColumnPageChange = async (
    columnIndex: number,
    newPage: number,
    parentUUID: string,
    onDataUpdate: (columnIndex: number, items: any[]) => void
  ) => {
    if (!loadChildren) return

    try {
      // Show loading state
      setLoadingColumns((prev) => new Set([...prev, columnIndex]))

      // Load new page
      const result = await loadChildren(
        parentUUID,
        newPage,
        undefined,
        showDeleted
      )

      // Clear loading state
      setLoadingColumns((prev) => {
        const newSet = new Set(prev)
        newSet.delete(columnIndex)
        return newSet
      })

      if (result && result.items) {
        // Update column data via callback
        onDataUpdate(columnIndex, result.items)

        // Update pagination info with final data
        setColumnPagination((prev) => {
          const newMap = new Map(prev)
          newMap.set(columnIndex, {
            currentPage: newPage,
            totalPages: result.totalPages,
            totalItems: result.totalItems,
          })
          return newMap
        })
      }
    } catch (error) {
      logger.error('Failed to load page:', error)
      // Clear loading state on error
      setLoadingColumns((prev) => {
        const newSet = new Set(prev)
        newSet.delete(columnIndex)
        return newSet
      })
    }
  }

  // Set initial pagination for a column
  const setPaginationForColumn = (
    columnIndex: number,
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
    }
  ) => {
    setColumnPagination((prev) => {
      const newMap = new Map(prev)
      newMap.set(columnIndex, pagination)
      return newMap
    })
  }

  // Remove pagination for a column
  const removePaginationForColumn = (columnIndex: number) => {
    setColumnPagination((prev) => {
      const newMap = new Map(prev)
      newMap.delete(columnIndex)
      return newMap
    })
  }

  // Clear all pagination
  const clearAllPagination = () => {
    setColumnPagination(new Map())
  }

  // Get pagination for a specific column
  const getPaginationForColumn = (columnIndex: number) => {
    return columnPagination.get(columnIndex)
  }

  // Check if column is loading
  const isColumnLoading = (columnIndex: number) => {
    return loadingColumns.has(columnIndex)
  }

  return {
    columnPagination,
    loadingColumns,
    handleColumnPageChange,
    setPaginationForColumn,
    removePaginationForColumn,
    clearAllPagination,
    getPaginationForColumn,
    isColumnLoading,
  }
}
