'use client'

import { useState } from 'react'

import { usePageSize } from '@/hooks/ui/use-page-size'

/**
 * The filter state every list page feeds into its query: page size and the deleted toggle.
 *
 * Separate from `useEntityListActions` because it runs BEFORE the list query, while everything in
 * the actions hook needs the query's RESULT. One hook holding both would be a circular dependency,
 * so the seam follows the data flow rather than the file.
 */
export function useEntityListFilters(onPageReset: () => void) {
  const [pageSize, handlePageSizeChange] = usePageSize(onPageReset)
  const [showDeleted, setShowDeleted] = useState(false)

  return { pageSize, showDeleted, setShowDeleted, handlePageSizeChange }
}

export type EntityListFilters = ReturnType<typeof useEntityListFilters>
