'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ObjectListItem } from 'io2p-client'

import { ScrollArea } from '@/components/ui'
import { permissionWhenKnown } from '@/components/entity-list'
import { ListErrorAlert } from '@/components/list-error'
import { useShownSearch } from '@/components/search-highlight'
import { useAuth } from '@/contexts'
import { isCappedCount, isLastListPage } from '@/lib/list-total'
import { nextSearch, searchInput } from '@/lib/search-text'
import { useObjects } from '@/hooks/api/entities'

import { ColumnHeader } from './column-header'
import { ColumnRow } from './column-row'
import type { MillerColumnActions } from './column-row-menu'

export type { MillerColumnActions }

const COLUMN_SIZE = 20

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
  const capped = isCappedCount(totalItems)
  const isLastPage = isLastListPage({
    capped,
    page,
    totalPages,
    rows: items.length,
    size: COLUMN_SIZE,
  })
  // Until the asked page lands, `isLastPage` reads the previous page's rows: a second click on next
  // would skip past the end.
  const changePage = (next: number) => {
    if (next > page && isPlaceholderData) return
    setPage(next)
  }

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
                onPageChange: changePage,
              }
            : undefined
        }
        isLoading={isLoading}
      />

      <ScrollArea className="flex-1">
        <div className="px-1 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="mr-2 h-6 w-6 animate-spin rounded-full motion-reduce:animate-none border-2 border-primary border-t-transparent" />
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
              {page > 1
                ? t('pagination.noMoreRows')
                : q
                  ? t('objects.noItemsMatch')
                  : t('objects.noItemsColumn')}
            </div>
          ) : (
            items.map((item) => (
              <ColumnRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                // Delete and restore are guarded at `admin`. This column lists at `scope: 'all'`,
                // so shared rows sit beside the viewer's own.
                permission={permissionWhenKnown(item, userId, authLoading)}
                isRestoring={isRestoring}
                search={shownSearch}
                onSelect={onSelect}
                onViewObject={onViewObject}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onShowQRCode={onShowQRCode}
                onCreateTemplate={onCreateTemplate}
                onRestore={onRestore}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
