import type { Page } from 'io2p-client'

import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

import type { DataTablePaginationProps } from './data-table'

// Maps a io2p `Page<T>` (1-based `page.number`) to the DataTable pagination props.
//
// `fallbackSize` is what the size Select shows before the first response lands. Pass the CHOSEN
// size, not the default, or the control reads 20 for a moment on a user who picked 50.
export function pageMeta(
  page: Page<unknown> | undefined,
  fallbackSize = DEFAULT_TABLE_PAGE_SIZE
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
