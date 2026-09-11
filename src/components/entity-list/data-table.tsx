'use client'

import { ReactNode, useEffect, useRef } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type VisibilityState,
  type OnChangeFn,
  type RowData,
} from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { cn } from '@/lib/utils'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Padding/alignment for this column's cells. The default `px-4` is right for text and far too
     * generous for a 40px thumbnail — it doubled the column's width and pushed the name away from
     * the image it belongs to.
     */
    cellClassName?: string
  }
}

/** Placeholder rows shown on FIRST load, before any data exists. */
const LOADING_ROWS = 8

/**
 * How long the pointer must REST on a row before its detail is prefetched.
 *
 * Without this, sweeping the mouse across a list fires one request per row it
 * crosses — 9 requests just to move from the toolbar to a row further down.
 * A short dwell separates "heading somewhere" from "looking at this one", which
 * is the only case worth spending a request on.
 */
const HOVER_INTENT_MS = 120

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  totalElements: number
  pageSize: number
  isFirstPage: boolean
  isLastPage: boolean
}

export interface DataTableProps<TData> {
  /** Column definitions (TanStack Table ColumnDef) */
  columns: ColumnDef<TData, unknown>[]
  /** Row data array */
  data: TData[]
  /** Unique row identifier — maps each row to a stable key (e.g. uuid) */
  getRowId: (row: TData) => string

  // -- Selection --
  /** Controlled row selection state (keyed by row id) */
  rowSelection?: RowSelectionState
  /** Callback when selection changes */
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /**
   * Whether row selection is enabled (adds checkbox column). Pass a function
   * to disable selection on a per-row basis (e.g. excluding draft rows from
   * "select all").
   */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)

  // -- Column visibility --
  /** Controlled column visibility state */
  columnVisibility?: VisibilityState
  /** Callback when visibility changes */
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>

  // -- Pagination (server-side) --
  /** Pagination info — omit to hide pagination */
  pagination?: DataTablePaginationProps
  onPageChange?: (page: number) => void
  onFirstPage?: () => void
  onPreviousPage?: () => void
  onNextPage?: () => void
  onLastPage?: () => void
  onPageSizeChange?: (size: number) => void

  // -- Row interactions --
  onRowClick?: (row: TData) => void
  /** Fired on pointer-enter — used to prefetch the row's detail. */
  onRowHover?: (row: TData) => void
  onRowDoubleClick?: (row: TData) => void
  /** Return additional className(s) per row */
  rowClassName?: (row: TData) => string | undefined

  // -- Column resizing --
  /** Enable user-draggable column resizing */
  enableColumnResizing?: boolean

  // -- Loading / empty --
  fetching?: boolean
  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  /**
   * The one thing to do from here. An empty table is the screen a first-time
   * user actually lands on, so it is the cheapest place to teach the concept and
   * hand over the next step — permanent and re-readable, unlike a tour.
   */
  emptyAction?: ReactNode

  /**
   * `<TableRow>`s rendered above the data rows. Receives the CURRENT visible column count, because
   * the column toggle changes it at runtime and a hard-coded span would drift out of the grid.
   *
   * For rows that are NOT part of the server page — local drafts, for one. They stay outside
   * TanStack's row model on purpose: they have no server id, so selection would hand a bulk action
   * an id the API has never issued, and counting them would make `totalElements` lie.
   */
  pinnedRows?: (colSpan: number) => ReactNode
  /** Suppresses the empty state when pinned rows are the only thing to show. */
  hasPinnedRows?: boolean
}

// ---------------------------------------------------------------------------
// Select column helper
// ---------------------------------------------------------------------------

export function getSelectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 20,
  }
}

// ---------------------------------------------------------------------------
// Column visibility dropdown
// ---------------------------------------------------------------------------

interface ColumnToggleItem {
  id: string
  labelKey: string
}

interface DataTableColumnToggleProps {
  columns: ColumnToggleItem[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (visibility: VisibilityState) => void
}

export function DataTableColumnToggle({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableColumnToggleProps) {
  const t = useTranslations()

  if (columns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          data-testid="column-toggle"
        >
          {t('objects.bulk.columns')}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              data-testid={`column-option-${col.id}`}
              checked={columnVisibility[col.id] !== false}
              onCheckedChange={(value) =>
                onColumnVisibilityChange({
                  ...columnVisibility,
                  [col.id]: !!value,
                })
              }
            >
              {t(col.labelKey)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// DataTable component
// ---------------------------------------------------------------------------

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  rowSelection = {},
  onRowSelectionChange,
  enableRowSelection = false,
  columnVisibility = {},
  onColumnVisibilityChange,
  pagination,
  onPageChange,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
  onRowClick,
  onRowHover,
  onRowDoubleClick,
  rowClassName,
  enableColumnResizing = false,
  fetching = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pinnedRows,
  hasPinnedRows = false,
}: DataTableProps<TData>) {
  const t = useTranslations()

  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    // Server-side pagination — we don't use client-side pagination model
    manualPagination: true,
    rowCount: pagination?.totalElements,
    // Selection
    enableRowSelection,
    onRowSelectionChange,
    // Column visibility
    onColumnVisibilityChange,
    // Column resizing
    enableColumnResizing,
    columnResizeMode: enableColumnResizing ? 'onChange' : undefined,
    state: {
      rowSelection,
      columnVisibility,
    },
  })

  const colCount = table.getVisibleFlatColumns().length

  // Hover intent. The timer is only ever touched from pointer handlers and the
  // unmount cleanup, both of which run after commit, so this never reads a ref
  // during render.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHover = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }
  const scheduleHover = (row: TData) => {
    if (!onRowHover) return
    cancelHover()
    hoverTimer.current = setTimeout(() => onRowHover(row), HOVER_INTENT_MS)
  }
  // Leaving the table entirely (or unmounting mid-dwell) must not fire a
  // prefetch for a row the pointer has already left.
  useEffect(() => cancelHover, [])

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-md border">
        <Table data-testid="data-table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    // The column id, matching `column-option-${col.id}` on the toggle. A spec that
                    // asserts a column is gone has to address it somehow, and the only other handle
                    // is the header's PROSE — which is translated, so the assertion is free on a
                    // Dutch account and the case reports green having tested nothing.
                    data-testid={`column-header-${header.column.id}`}
                    className={cn(
                      enableColumnResizing && 'relative',
                      header.column.columnDef.meta?.cellClassName
                    )}
                    style={
                      enableColumnResizing
                        ? { width: header.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {enableColumnResizing && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                          header.column.getIsResizing()
                            ? 'bg-primary'
                            : 'bg-border hover:bg-primary/50'
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {/* Loading has two distinct shapes.
                First load (no rows yet): skeleton rows, so the table keeps its
                height and column widths instead of collapsing to one line and
                pushing the pagination bar up the page.
                Refetch (rows already present): keep them, dimmed. This is the
                whole point of `placeholderData: keepPreviousData` on the list
                queries — replacing the rows with a spinner threw the previous
                page away and made paging flash, defeating it. */}
            {pinnedRows?.(colCount)}
            {fetching && table.getRowModel().rows.length === 0 ? (
              Array.from({ length: LOADING_ROWS }).map((_, i) => (
                <TableRow key={`loading-${i}`} aria-hidden="true">
                  {Array.from({ length: colCount }).map((__, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full max-w-[12rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 && !hasPinnedRows ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle || t('common.noResults')}
                    description={emptyDescription}
                    action={emptyAction}
                    className="py-8"
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid="data-table-row"
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  onPointerEnter={() => scheduleHover(row.original)}
                  onPointerLeave={cancelHover}
                  onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  className={cn(
                    onRowClick || onRowDoubleClick
                      ? 'cursor-pointer'
                      : undefined,
                    // Refetching with rows still on screen: dim rather than
                    // replace, so paging reads as an update instead of a flash.
                    fetching && 'opacity-50 transition-opacity',
                    rowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* No selection count here: `BulkActionBar` already carries one, and every table that turns
          selection on renders it. Two counters disagreed about what the number MEANT — this one
          read "20 of 25", counting a total across pages against a selection you make one page at a
          time, so the 5 looked deliberately unselected rather than simply elsewhere. */}

      {/* Server-side pagination */}
      {pagination && (
        <TablePagination
          currentPage={pagination.currentPage - 1}
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          pageSize={pagination.pageSize}
          isFirstPage={pagination.isFirstPage}
          isLastPage={pagination.isLastPage}
          onPageChange={(page) => onPageChange?.(page)}
          onFirst={() => onFirstPage?.()}
          onPrevious={() => onPreviousPage?.()}
          onNext={() => onNextPage?.()}
          onLast={() => onLastPage?.()}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
