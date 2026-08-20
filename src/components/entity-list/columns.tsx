'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  EyeOff,
} from 'lucide-react'

import {
  Button,
  CopyButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

import { getSelectColumn } from './data-table'
import type { CoverImage } from 'io2p-client'

import { CoverCell } from './cover-cell'
import type { EntitySort } from './use-entity-list-query'

interface SortableOpts {
  /** Make the column header a server-side sort toggle (the column `id` must be the sort field). */
  sortable?: boolean
}

// Server-side sorting is owned by the query, not TanStack — a header cycles the shared sort state.
const SortContext = createContext<{
  sort?: EntitySort
  onChange?: (sort?: EntitySort) => void
}>({})

export function SortProvider({
  sort,
  onChange,
  children,
}: {
  sort?: EntitySort
  onChange?: (sort?: EntitySort) => void
  children: ReactNode
}) {
  return (
    <SortContext.Provider value={{ sort, onChange }}>
      {children}
    </SortContext.Provider>
  )
}

/**
 * Lets a header hide its own column. Separate from `SortContext` because a table
 * can be sortable without being hideable, and the menu drops the Hide entry when
 * no provider supplies this.
 */
const HideContext = createContext<{ onHide?: (id: string) => void }>({})

export function HideProvider({
  onHide,
  children,
}: {
  onHide?: (id: string) => void
  children: ReactNode
}) {
  return (
    <HideContext.Provider value={{ onHide }}>{children}</HideContext.Provider>
  )
}

function SortableHeader({
  field,
  label,
  sortable,
}: {
  field: string
  label: string
  sortable: boolean
}) {
  const t = useTranslations()
  const { sort, onChange } = useContext(SortContext)
  const { onHide } = useContext(HideContext)
  const isAsc = sortable && sort === field
  const isDesc = sortable && sort === `-${field}`

  // Nothing to offer: not sortable, and no provider to hide it.
  if (!sortable && !onHide) return <>{label}</>

  // Clicking the label keeps the one-click cycle. The menu exists because a
  // cycle cannot show its own states: nothing says a third click clears the
  // sort, and desc → asc costs two clicks through an unlabelled one.
  const cycle = () =>
    onChange?.(
      isAsc
        ? (`-${field}` as EntitySort)
        : isDesc
          ? undefined
          : (field as EntitySort)
    )

  return (
    <div className="-ml-3 flex items-center">
      {sortable ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 pr-1"
          onClick={cycle}
        >
          {label}
          {/* Only when sorted. An idle indicator next to the menu chevron reads
              as two halves of one broken control rather than two affordances. */}
          {isAsc ? (
            <ArrowUp className="ml-1 h-3.5 w-3.5" />
          ) : isDesc ? (
            <ArrowDown className="ml-1 h-3.5 w-3.5" />
          ) : null}
        </Button>
      ) : (
        <span className="px-3 text-sm font-medium">{label}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-6 px-0"
            aria-label={t('common.columnOptions', { column: label })}
            data-testid={`column-menu-${field}`}
          >
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {sortable ? (
            <>
              <DropdownMenuItem
                onSelect={() => onChange?.(field as EntitySort)}
              >
                <ChevronUp className="mr-2 h-3.5 w-3.5" />
                {t('common.sortAsc')}
                {isAsc ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onChange?.(`-${field}` as EntitySort)}
              >
                <ChevronDown className="mr-2 h-3.5 w-3.5" />
                {t('common.sortDesc')}
                {isDesc ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
            </>
          ) : null}
          {sortable && onHide ? <DropdownMenuSeparator /> : null}
          {onHide ? (
            <DropdownMenuItem onSelect={() => onHide(field)}>
              <EyeOff className="mr-2 h-3.5 w-3.5" />
              {t('common.hideColumn')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * The node sorts by `name`, `createdAt` and `updatedAt` and nothing else, so a
 * column outside that set gets the menu WITHOUT the sort entries rather than no
 * menu at all — otherwise it could never be hidden from its own header.
 */
function headerCell<T>(
  id: string,
  label: string,
  sortable: boolean | undefined
): Pick<ColumnDef<T, unknown>, 'header' | 'enableSorting'> {
  return {
    enableSorting: false,
    header: () => (
      <SortableHeader field={id} label={label} sortable={sortable === true} />
    ),
  }
}

export function selectColumn<T>(): ColumnDef<T, unknown> {
  return getSelectColumn<T>()
}

/**
 * The cover thumbnail column. No header label — the pictures are self-evident and a word above a
 * 40px column only steals width from Name.
 *
 * Fixed size so a row without a cover is exactly as tall as one with it; a column that changes the
 * row height as covers arrive would make the whole table jump on load.
 */
export function coverColumn<T>(
  getCover: (row: T) => CoverImage | null | undefined,
  getName: (row: T) => string
): ColumnDef<T, unknown> {
  return {
    id: 'cover',
    header: () => null,
    cell: ({ row }) => (
      <CoverCell cover={getCover(row.original)} name={getName(row.original)} />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
    // The default px-4 is for text. On a 40px thumbnail it doubled the column and left 32px of dead
    // space before the name — the picture and the name it belongs to have to read as one unit.
    meta: { cellClassName: 'w-10 pl-2 pr-0' },
  }
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
    ...headerCell<T>('id', header, false),
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
