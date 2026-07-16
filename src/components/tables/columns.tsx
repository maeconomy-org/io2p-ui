'use client'

import type { ReactNode } from 'react'
import type { Column, ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react'

import {
  Button,
  CopyButton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { cn } from '@/lib'

import { getSelectColumn } from './data-table'

interface SortableOpts {
  /** Make the column header a server-side sort toggle (needs the table's sort wiring). */
  sortable?: boolean
}

// A clickable header that cycles asc → desc → none via TanStack's toggle handler.
function SortableHeader<T>({
  column,
  label,
}: {
  column: Column<T, unknown>
  label: string
}) {
  const sorted = column.getIsSorted()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="ml-1 h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
      )}
    </Button>
  )
}

function headerCell<T>(
  id: string,
  label: string,
  sortable: boolean | undefined
): Pick<ColumnDef<T, unknown>, 'header' | 'enableSorting'> {
  if (!sortable) return { header: () => label, enableSorting: false }
  return {
    enableSorting: true,
    header: ({ column }) => <SortableHeader column={column} label={label} />,
  }
}

export function selectColumn<T>(): ColumnDef<T, unknown> {
  return getSelectColumn<T>()
}

export function textColumn<T>(
  id: string,
  header: string,
  get: (row: T) => ReactNode,
  opts: SortableOpts = {}
): ColumnDef<T, unknown> {
  return {
    id,
    ...headerCell<T>(id, header, opts.sortable),
    cell: ({ row }) => get(row.original) ?? '—',
  }
}

export function idColumn<T>(
  get: (row: T) => string,
  header = 'ID'
): ColumnDef<T, unknown> {
  return {
    id: 'id',
    header: () => header,
    enableSorting: false,
    cell: ({ row }) => {
      const id = get(row.original)
      return (
        <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <span className="hidden sm:inline">{id}</span>
          <span className="sm:hidden">{id.slice(0, 5)}...</span>
          <CopyButton text={id} label={header} />
        </div>
      )
    },
  }
}

export function formatTimestamp(ms?: number): string {
  if (ms === undefined || ms === null) return '—'
  return new Date(ms).toLocaleString()
}

export function timestampColumn<T>(
  id: string,
  header: string,
  get: (row: T) => number | undefined,
  opts: SortableOpts = {}
): ColumnDef<T, unknown> {
  return {
    id,
    ...headerCell<T>(id, header, opts.sortable),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatTimestamp(get(row.original))}
      </span>
    ),
  }
}

export function nameColumn<T>(
  getName: (row: T) => string,
  options: {
    header?: string
    sortable?: boolean
    getChildCount?: (row: T) => number | undefined
    getDeleted?: (row: T) => boolean
    deletedLabel?: string
    childrenTooltip?: (count: number) => string
  } = {}
): ColumnDef<T, unknown> {
  const { header = 'Name', getChildCount, getDeleted } = options
  return {
    id: 'name',
    ...headerCell<T>('name', header, options.sortable),
    cell: ({ row }) => {
      const name = getName(row.original)
      const count = getChildCount?.(row.original) ?? 0
      const deleted = getDeleted?.(row.original) ?? false
      return (
        <div className="flex items-center font-medium">
          <span
            className={cn(
              'max-w-[200px] truncate',
              deleted && 'text-destructive line-through'
            )}
          >
            {name}
          </span>
          {deleted && options.deletedLabel && (
            <span className="ml-2 text-xs text-destructive">
              {options.deletedLabel}
            </span>
          )}
          {count > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {count}
                    <ChevronRight className="h-2.5 w-2.5" />
                  </span>
                </TooltipTrigger>
                {options.childrenTooltip && (
                  <TooltipContent side="right">
                    {options.childrenTooltip(count)}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    },
  }
}

export function actionsColumn<T>(
  render: (row: T) => ReactNode,
  header = ''
): ColumnDef<T, unknown> {
  return {
    id: 'actions',
    header: () => <span className="block text-right">{header}</span>,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => render(row.original),
  }
}
