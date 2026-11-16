'use client'

import { ListErrorAlert } from '@/components/list-error'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronRight,
  Copy,
  FileText,
  MoreHorizontal,
  QrCode,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  Button,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import {
  CountUnavailable,
  OwnerHint,
  canDelete,
  permissionWhenKnown,
} from '@/components/entity-list'
import { SearchHighlight, useShownSearch } from '@/components/search-highlight'
import { useAuth } from '@/contexts'
import { copyText } from '@/lib/clipboard'
import { isCappedTotal, mayHaveChildren, TOTAL_CAP } from '@/lib/list-total'
import { nextSearch, searchInput } from '@/lib/search-text'
import { cn, truncateText } from '@/lib/utils'
import { useObjects } from '@/hooks/api/entities'

import { ColumnHeader } from './column-header'

const COLUMN_SIZE = 20

export interface MillerColumnActions {
  onViewObject?: (o: ObjectListItem) => void
  onDelete?: (o: ObjectListItem) => void
  onDuplicate?: (o: ObjectListItem) => void
  onShowQRCode?: (o: ObjectListItem) => void
  onCreateTemplate?: (o: ObjectListItem) => void
  onRestore?: (o: ObjectListItem) => void
}

interface MillerColumnProps extends MillerColumnActions {
  /**
   * Parent object id. `''` is the FIRST column, which lists everything rather than only roots.
   *
   * `?parent=` (empty) would return roots only, and that made the two views of /objects disagree:
   * the table showed 25 objects, this showed the 5 with no parent, and nothing on screen explained
   * the gap. Users reasonably expect the same data either way — the column view exists to make
   * drilling down easier, not to show a different set.
   *
   * The trade: an object with a parent appears in column 1 AND again under that parent. Accepted
   * deliberately (user, 2026-07-30) — column 1 is "everything", each later column is "what is
   * inside the row you opened".
   */
  parentId: string
  title: string
  selectedId: string | null
  showDeleted?: boolean
  isRestoring?: boolean
  /** Same access slice as the table, or the node quietly narrows to `mine`. */
  scope?: 'mine' | 'shared' | 'public' | 'all'
  onSelect: (item: ObjectListItem) => void
}

export function MillerColumn({
  parentId,
  title,
  selectedId,
  showDeleted = false,
  scope = 'all',
  isRestoring = false,
  onSelect,
  onViewObject,
  onDelete,
  onDuplicate,
  onShowQRCode,
  onCreateTemplate,
  onRestore,
}: MillerColumnProps) {
  const t = useTranslations()
  const { userId, authLoading } = useAuth()
  const [typed, setTyped] = useState('')
  // One state, so a new `q` and page 1 land in the same render. As an effect on `q` it was state
  // syncing state — a render where page 3 was already paired with the new term, and the compiler
  // lint rejects setState in an effect body. A timer callback is fine.
  const [{ q, page }, setList] = useState<{ q?: string; page: number }>({
    page: 1,
  })
  const setPage = (next: number) => setList((list) => ({ ...list, page: next }))

  useEffect(() => {
    const id = setTimeout(() => {
      setList((list) => {
        const next = nextSearch(searchInput(typed, 'words'), list.q)
        return next === list.q ? list : { q: next, page: 1 }
      })
    }, 300)
    return () => clearTimeout(id)
  }, [typed])

  const {
    data,
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
    isPlaceholderData,
  } = useObjects().useList(
    {
      // Verbatim, including the empty string the first column passes: `?parent=` means ROOTS ONLY
      // to the node, and `|| undefined` dropped the filter instead — so column one listed every
      // object at any depth, and expanding a row showed children that were already in it.
      parent: parentId,
      scope,
      page,
      size: COLUMN_SIZE,
      q,
      deleted: showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { keepPreviousData: true }
  )
  const shownSearch = useShownSearch(q, isPlaceholderData)

  const items = data?.data ?? []
  const totalPages = data?.page.totalPages ?? 1
  const totalItems = data?.page.totalElements ?? 0
  const capped = isCappedTotal(totalItems, true)
  // A capped total does not say where the column ends; a page with fewer rows than asked does.
  const isLastPage = capped ? items.length < COLUMN_SIZE : page >= totalPages

  return (
    <div className="flex h-full min-w-[250px] max-w-[300px] flex-1 flex-col overflow-hidden border-r">
      <ColumnHeader
        title={title}
        searchTerm={typed}
        onSearchChange={setTyped}
        itemCount={totalItems}
        capped={capped}
        pagination={
          totalPages > 1 || page > 1
            ? {
                currentPage: page,
                totalPages,
                totalItems,
                isLastPage,
                onPageChange: setPage,
              }
            : undefined
        }
        isLoading={isLoading}
      />

      <ScrollArea className="flex-1">
        <div className="px-1 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                {t('objects.loadingChildren')}
              </span>
            </div>
          ) : isError && items.length === 0 ? (
            <ListErrorAlert
              error={error}
              onRetry={() => void refetch()}
              retrying={isFetching}
              className="m-2 w-auto"
            />
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {q ? t('objects.noItemsMatch') : t('objects.noItemsColumn')}
            </div>
          ) : (
            items.map((item) => {
              const isSelected = item.id === selectedId
              const isDeleted = item.deleted
              // Delete and restore are guarded at `admin`. This column lists at `scope: 'all'`,
              // so shared rows sit beside the viewer's own.
              const permission = permissionWhenKnown(item, userId, authLoading)

              return (
                <div
                  key={item.id}
                  className={cn(
                    'mb-1 flex cursor-pointer items-center justify-between rounded-md p-2',
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                    isDeleted && 'border border-red-200 bg-red-50'
                  )}
                  onClick={() => onSelect(item)}
                  onDoubleClick={() => onViewObject?.(item)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={cn(
                        'select-none truncate text-sm font-medium',
                        isDeleted &&
                          'text-red-700 line-through dark:text-red-400'
                      )}
                    >
                      <SearchHighlight
                        text={truncateText(
                          item.name || t('objects.unnamed'),
                          25,
                          true
                        )}
                        q={shownSearch}
                      />
                    </span>
                    <OwnerHint
                      ownerUserId={item.createdBy}
                      ownerName={item.createdByName}
                    />
                    {item.childCount === undefined ? (
                      <CountUnavailable label={t('common.countUnavailable')} />
                    ) : (
                      item.childCount > 0 && (
                        <span
                          className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700"
                          data-testid="child-count-badge"
                        >
                          {isCappedTotal(item.childCount, true)
                            ? t('common.totalMoreThan', { count: TOTAL_CAP })
                            : item.childCount}
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewObject?.(item)}>
                          <FileText className="mr-2 h-4 w-4" />
                          {t('objects.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await copyText(item.id)
                            toast[ok ? 'success' : 'error'](
                              ok
                                ? t('copyButton.copiedWithLabel', {
                                    label: 'UUID',
                                  })
                                : t('copyButton.failedToCopy')
                            )
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t('objects.actions.copyUuid')}
                        </DropdownMenuItem>
                        {onShowQRCode && (
                          <DropdownMenuItem onClick={() => onShowQRCode(item)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            {t('objects.actions.showQrCode')}
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && !isDeleted && (
                          <DropdownMenuItem onClick={() => onDuplicate(item)}>
                            <Copy className="mr-2 h-4 w-4" />
                            {t('objects.duplicate.action')}
                          </DropdownMenuItem>
                        )}
                        {onCreateTemplate && !isDeleted && (
                          <DropdownMenuItem
                            onClick={() => onCreateTemplate(item)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {t('objects.createTemplate')}
                          </DropdownMenuItem>
                        )}
                        {(onDelete || onRestore) && canDelete(permission) && (
                          <>
                            <DropdownMenuSeparator />
                            {isDeleted
                              ? onRestore && (
                                  <DropdownMenuItem
                                    onClick={() => onRestore(item)}
                                    disabled={isRestoring}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4 text-blue-600" />
                                    {t('objects.restoreTitle')}
                                  </DropdownMenuItem>
                                )
                              : onDelete && (
                                  <DropdownMenuItem
                                    onClick={() => onDelete(item)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {mayHaveChildren(item.childCount) && (
                      <ChevronRight
                        className="ml-1 h-4 w-4 text-muted-foreground"
                        data-testid="opens-column"
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
