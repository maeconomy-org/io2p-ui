import type { Page } from 'io2p-client'

import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { isCappedTotal } from '@/lib/list-total'

import type { DataTablePaginationProps } from './data-table'

export interface PageMetaOptions {
  /** The node caps this list's total at 1001 (objects, processes, formulas, constants, templates). */
  capped?: boolean
  /** The page asked for: it stays known when the answer is missing (an error, a first load). */
  requestedPage?: number
}

// Maps a io2p `Page<T>` (1-based `page.number`) to the DataTable pagination props.
//
// `fallbackSize` is what the size Select shows before the first response lands. Pass the CHOSEN
// size, not the default, or the control reads 20 for a moment on a user who picked 50.
export function pageMeta(
  page: Page<unknown> | undefined,
  fallbackSize = DEFAULT_TABLE_PAGE_SIZE,
  { capped = false, requestedPage }: PageMetaOptions = {}
): DataTablePaginationProps {
  const p = page?.page
  const number = p?.number ?? requestedPage ?? 1
  const totalPages = p?.totalPages ?? 0
  const totalElements = p?.totalElements ?? 0
  const pageSize = p?.size ?? fallbackSize
  const rowsOnPage = page?.data.length ?? 0
  const knownCapped = isCappedTotal(totalElements, capped)
  return {
    currentPage: number,
    totalPages,
    totalElements,
    pageSize,
    capped: knownCapped,
    rowsOnPage,
    pastEnd: page !== undefined && rowsOnPage === 0 && number > 1,
    isFirstPage: number <= 1,
    // A capped total does not say where the list ends; a page with fewer rows than asked does.
    isLastPage: knownCapped
      ? rowsOnPage < pageSize
      : totalPages === 0
        ? true
        : number >= totalPages,
  }
}
