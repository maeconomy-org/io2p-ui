import type { Page } from 'io2p-client'

import type { DataTablePaginationProps } from './data-table'

// Maps a io2p `Page<T>` (1-based `page.number`) to the DataTable pagination props.
export function pageMeta(
  page: Page<unknown> | undefined,
  fallbackSize = 15
): DataTablePaginationProps {
  const p = page?.page
  const number = p?.number ?? 1
  const totalPages = p?.totalPages ?? 0
  return {
    currentPage: number,
    totalPages,
    totalElements: p?.totalElements ?? 0,
    pageSize: p?.size ?? fallbackSize,
    isFirstPage: number <= 1,
    isLastPage: totalPages === 0 ? true : number >= totalPages,
  }
}
