'use client'

import { ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  type OnChangeFn,
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
} from '@/components/ui'
import { cn } from '@/lib'

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
  /** Whether row selection is enabled (adds checkbox column) */
  enableRowSelection?: boolean

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
  onRowDoubleClick?: (row: TData) => void
  /** Return additional className(s) per row */
  rowClassName?: (row: TData) => string | undefined

  // -- Loading / empty --
  fetching?: boolean
  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
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
        <Button variant="outline" size="sm" className="h-8">
          {t('objects.bulk.columns')}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
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
  onRowDoubleClick,
  rowClassName,
  fetching = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
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
    state: {
      rowSelection,
      columnVisibility,
    },
  })

  const colCount = table.getVisibleFlatColumns().length

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {fetching ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-4">
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                    {t('common.updating')}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8">
                  <div className="flex flex-col items-center">
                    {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
                    {emptyTitle && (
                      <h3 className="text-lg font-medium mb-2">{emptyTitle}</h3>
                    )}
                    {emptyDescription && (
                      <p className="text-sm text-muted-foreground">
                        {emptyDescription}
                      </p>
                    )}
                    {!emptyTitle && !emptyDescription && (
                      <p className="text-sm text-muted-foreground">
                        {t('common.noResults')}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  className={cn(
                    onRowClick || onRowDoubleClick
                      ? 'cursor-pointer'
                      : undefined,
                    rowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      {/* Selection info */}
      {enableRowSelection && Object.keys(rowSelection).length > 0 && (
        <div className="text-muted-foreground text-sm px-2 pt-2">
          {t('objects.bulk.selected', {
            selected: Object.keys(rowSelection).length,
            total: pagination?.totalElements ?? data.length,
          })}
        </div>
      )}

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
