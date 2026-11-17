'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  ChildCount,
  OwnerHint,
  type permissionWhenKnown,
} from '@/components/entity-list'
import { SearchHighlight } from '@/components/search-highlight'
import { mayHaveChildren } from '@/lib/list-total'
import { cn, truncateText } from '@/lib/utils'

import { ColumnRowMenu, type MillerColumnActions } from './column-row-menu'

interface ColumnRowProps extends MillerColumnActions {
  item: ObjectListItem
  isSelected: boolean
  permission: ReturnType<typeof permissionWhenKnown>
  isRestoring: boolean
  /** The search the rows answer, for the marks in the name. */
  search?: string
  onSelect: (item: ObjectListItem) => void
}

export function ColumnRow({
  item,
  isSelected,
  permission,
  isRestoring,
  search,
  onSelect,
  ...actions
}: ColumnRowProps) {
  const t = useTranslations()
  const isDeleted = item.deleted

  return (
    <div
      className={cn(
        'mb-1 flex cursor-pointer items-center justify-between rounded-md p-2',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
        isDeleted &&
          'border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
      )}
      onClick={() => onSelect(item)}
      onDoubleClick={() => actions.onViewObject?.(item)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* No handler of its own: Enter and Space click it, and the click reaches the row's, so
            the keyboard selects exactly as the mouse does. */}
        <button
          type="button"
          aria-current={isSelected ? 'true' : undefined}
          data-testid="column-row"
          className="flex min-w-0 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              'select-none truncate text-sm font-medium',
              isDeleted && 'text-red-700 line-through dark:text-red-400'
            )}
          >
            <SearchHighlight
              text={truncateText(item.name || t('objects.unnamed'), 25, true)}
              q={search}
            />
          </span>
          <OwnerHint
            ownerUserId={item.createdBy}
            ownerName={item.createdByName}
          />
        </button>
        <ChildCount
          count={item.childCount}
          className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          testId="child-count-badge"
        />
      </div>

      <div className="flex items-center">
        <ColumnRowMenu
          item={item}
          permission={permission}
          isRestoring={isRestoring}
          {...actions}
        />
        {mayHaveChildren(item.childCount) && (
          <ChevronRight
            className="ml-1 h-4 w-4 text-muted-foreground"
            data-testid="opens-column"
          />
        )}
      </div>
    </div>
  )
}
