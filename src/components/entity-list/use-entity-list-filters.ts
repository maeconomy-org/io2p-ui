'use client'

import { useCallback, useState } from 'react'

import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

/**
 * The filter state every list page feeds into its query: page size and the deleted toggle.
 *
 * Separate from `useEntityListActions` because it runs BEFORE the list query, while everything in
 * the actions hook needs the query's RESULT. One hook holding both would be a circular dependency,
 * so the seam follows the data flow rather than the file.
 */
export function useEntityListFilters(onPageReset: () => void) {
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [showDeleted, setShowDeleted] = useState(false)

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      onPageReset()
    },
    [onPageReset]
  )

  return { pageSize, showDeleted, setShowDeleted, handlePageSizeChange }
}

export type EntityListFilters = ReturnType<typeof useEntityListFilters>
