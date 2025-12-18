'use client'

import { useState } from 'react'

import { logger } from '@/lib'

interface UseColumnSelectionProps {
  loadChildren?: (
    parentUUID: string,
    page?: number,
    searchTerm?: string,
    showDeleted?: boolean
  ) => Promise<{ items: any[]; totalPages: number; totalItems: number }>
  showDeleted?: boolean
  onPaginationSet: (
    columnIndex: number,
    pagination: { currentPage: number; totalPages: number; totalItems: number }
  ) => void
  onPaginationRemove: (columnIndex: number) => void
  onLoadingSet: (columnIndex: number, loading: boolean) => void
}

export function useColumnSelection({
  loadChildren,
  showDeleted = false,
  onPaginationSet,
  onPaginationRemove,
  onLoadingSet,
}: UseColumnSelectionProps) {
  const [columns, setColumns] = useState<any[][]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [path, setPath] = useState<any[]>([])

  // Handle item selection in a column - now with pagination
  const handleSelectItem = async (item: any, columnIndex: number) => {
    // Update selected IDs up to this column
    const newSelectedIds = [...selectedIds.slice(0, columnIndex), item.uuid]
    setSelectedIds(newSelectedIds)

    // Update path
    const newPath = [...path.slice(0, columnIndex), item]
    setPath(newPath)

    // Check if item has children using enhanced data
    const hasChildren = item.hasChildren || (item.childCount ?? 0) > 0
    const nextColumnIndex = columnIndex + 1

    if (hasChildren && loadChildren) {
      try {
        // Show loading state for next column
        onLoadingSet(nextColumnIndex, true)

        // Load first page of children with pagination info
        const result = await loadChildren(item.uuid, 1, undefined, showDeleted) // Page 1 (1-based)

        // Clear loading state
        onLoadingSet(nextColumnIndex, false)

        if (result && result.items && result.items.length > 0) {
          // Set children data
          setColumns([...columns.slice(0, columnIndex + 1), result.items])

          // Set pagination info for this column
          onPaginationSet(nextColumnIndex, {
            currentPage: 1,
            totalPages: result.totalPages,
            totalItems: result.totalItems,
          })
        } else {
          // No children returned, trim columns
          setColumns(columns.slice(0, columnIndex + 1))
          // Remove pagination info for this column
          onPaginationRemove(nextColumnIndex)
        }
      } catch (error) {
        logger.error('Failed to load children:', error)
        // Clear loading state on error
        onLoadingSet(nextColumnIndex, false)
        // On error, trim columns and clear pagination
        setColumns(columns.slice(0, columnIndex + 1))
        onPaginationRemove(nextColumnIndex)
      }
    } else if (item.children && item.children.length > 0) {
      // Fallback to static children if available (for backward compatibility)
      setColumns([...columns.slice(0, columnIndex + 1), item.children])
    } else {
      // No children, so trim columns
      setColumns(columns.slice(0, columnIndex + 1))
    }
  }

  // Update columns data (used by pagination)
  const updateColumnData = (columnIndex: number, items: any[]) => {
    const newColumns = [...columns]
    newColumns[columnIndex] = items
    setColumns(newColumns)
  }

  // Initialize with root data
  const initializeWithData = (data: any[]) => {
    if (data && data.length > 0) {
      setColumns([data])
      setSelectedIds([])
      setPath([])
    }
  }

  return {
    columns,
    selectedIds,
    path,
    handleSelectItem,
    updateColumnData,
    initializeWithData,
  }
}
