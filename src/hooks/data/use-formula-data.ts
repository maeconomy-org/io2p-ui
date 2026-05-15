'use client'

import { useMemo } from 'react'
import type { UUMathFormulaDTO } from 'iom-sdk'

import { useMathFormulas } from '@/hooks'

interface UseFormulaDataProps {
  page?: number
  pageSize?: number
  showDeleted?: boolean
}

/**
 * Hook for managing formula data with pagination and filtering
 */
export function useFormulaData({
  showDeleted = false,
  page = 0,
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
    data: pageData,
    isLoading,
    isFetching,
  } = useSearchFormulas(
    searchParams,
    { page, size: pageSize },
    { enabled: true }
  )

  const data = useMemo<UUMathFormulaDTO[]>(
    () =>
      (pageData?.content ?? []).filter(
        (f): f is UUMathFormulaDTO => !!f.uuid && !!f.name && !!f.expression
      ),
    [pageData]
  )

  return {
    data,
    totalElements: pageData?.totalElements ?? 0,
    totalPages: pageData?.totalPages ?? 0,
    loading: isLoading,
    fetching: isFetching,
  }
}
