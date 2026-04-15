'use client'

import { useState, useMemo } from 'react'
import { keepPreviousData } from '@tanstack/react-query'

import { useMathFormulas, usePagination } from '@/hooks'

interface UseFormulaDataProps {
  pageSize?: number
  showDeleted?: boolean
}

/**
 * Hook for managing formula data with pagination and filtering
 */
export function useFormulaData({
  showDeleted = false,
  pageSize = 15,
}: UseFormulaDataProps = {}) {
  const { useSearchFormulas } = useMathFormulas()

  const searchParams = useMemo(
    () => ({
      ...(showDeleted ? {} : { softDeleted: false }),
    }),
    [showDeleted]
  )

  const {
    data: formulas,
    isLoading,
    isFetching,
  } = useSearchFormulas(searchParams, {
    enabled: true,
  })

  return {
    data: formulas || [],
    loading: isLoading,
    fetching: isFetching,
  }
}
