'use client'

import { useMemo, useRef, type ReactNode } from 'react'
import type {
  ColumnDef,
  OnChangeFn,
  Row,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table'
import type { Page } from 'io2p-client'

import { DataTable } from './data-table'
import { SearchMarkProvider } from '@/components/search-highlight'

import { pageMeta } from './page-meta'
import { HideProvider, SortProvider } from './columns'
import type { EntitySort } from './use-entity-list-query'

export interface EntityTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  page?: Page<T>
  getRowId: (row: T) => string
  fetching?: boolean
  /** The search the rows answer: its words are marked in the names. Lists of words only. */
  highlight?: string
  /**
   * The list query's error, `null` when it has none. Required, so a page cannot forget it: without
   * it a failed list shows as an empty one.
   */
  error: unknown
  onRetry?: () => void

  // Pagination — 1-based to the outside; the 0↔1 conversion lives here only.
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** The chosen size, shown until the first response carries its own. */
  pageSize?: number
  /** The node caps this list's total at 1001: see `isCappedTotal`. */
  capped?: boolean
  /** The page asked for, so the controls stay when the answer is missing (an error). */
  requestedPage?: number

  // Sorting — providing onSortChange enables sortable headers (server-side).
  sort?: EntitySort
  onSortChange?: (sort?: EntitySort) => void

  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  enableRowSelection?: boolean | ((row: Row<T>) => boolean)

  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>

  onRowClick?: (row: T) => void
  /** Fired on pointer-enter — used to prefetch the row's detail. */
  onRowHover?: (row: T) => void
  onRowDoubleClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined

  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode

  /** Rows above the server page — see DataTable. Forwarded via `...rest`. */
  pinnedRows?: (colSpan: number) => ReactNode
  hasPinnedRows?: boolean
}

export function EntityTable<T>({
  columns,
  page,
  getRowId,
  fetching = false,
  onPageChange,
  onPageSizeChange,
  pageSize,
  highlight,
  capped = false,
  requestedPage,
  sort,
  onSortChange,
  ...rest
}: EntityTableProps<T>) {
  // TanStack Table rebuilds its row model whenever `data` changes identity, and
  // `?? []` minted a fresh array on every render while `page` was undefined —
  // i.e. throughout loading, when the table is already doing the most work.
  const data = useMemo(() => page?.data ?? [], [page])
  const meta = pageMeta(page, pageSize, { capped, requestedPage })

  // `totalPages` bounds a page change only when it is known and exact: a capped total makes it a
  // lower limit, and with no answer (an error) it is 0.
  const lastKnownPage =
    meta.capped || !page ? Infinity : Math.max(1, meta.totalPages)
  // While a page loads, `meta` is still the previous page's: repeat clicks would ask again for
  // the page already on its way.
  const lastAsked = useRef<number | undefined>(undefined)
  const emit = (page1Based: number) => {
    const next = Math.min(Math.max(1, page1Based), lastKnownPage)
    if (fetching && next === lastAsked.current) return
    lastAsked.current = next
    onPageChange?.(next)
  }

  const onHide = useMemo(() => {
    const set = rest.onColumnVisibilityChange
    if (!set) return undefined
    return (id: string) => set({ ...rest.columnVisibility, [id]: false })
  }, [rest.onColumnVisibilityChange, rest.columnVisibility])

  return (
    <SearchMarkProvider value={highlight}>
      <SortProvider sort={sort} onChange={onSortChange}>
        <HideProvider onHide={onHide}>
          <DataTable
            columns={columns}
            data={data}
            getRowId={getRowId}
            fetching={fetching}
            pagination={meta}
            onPageChange={(zeroBased) => emit(zeroBased + 1)}
            onFirstPage={() => emit(1)}
            onPreviousPage={() => emit(meta.currentPage - 1)}
            onNextPage={() => emit(meta.currentPage + 1)}
            onLastPage={() => emit(meta.totalPages)}
            onPageSizeChange={onPageSizeChange}
            {...rest}
          />
        </HideProvider>
      </SortProvider>
    </SearchMarkProvider>
  )
}
