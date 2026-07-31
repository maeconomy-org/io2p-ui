'use client'

import { useState, useCallback, useMemo } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { PlusCircle, Ruler } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { ConstantDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
  type OwnerFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useConstants } from '@/hooks/api/leaves'
import { useAuth, useSearch } from '@/contexts'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib/logger'

import {
  buildConstantColumns,
  type ConstantColumnActions,
} from './components/constant-columns'

const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
const ConstantSheet = dynamic(
  () =>
    import('@/components/constants/constant-sheet').then(
      (m) => m.ConstantSheet
    ),
  { ssr: false }
)

type SheetState = { mode: 'create' } | { mode: 'edit'; constant: ConstantDTO }

export default function ConstantsPage() {
  const t = useTranslations()

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [shareTarget, setShareTarget] = useState<ConstantDTO | null>(null)
  const [toDelete, setToDelete] = useState<ConstantDTO | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useConstants()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const { data: constantsPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      // `all`: built-ins are shared, so `mine` would hide most of the library.
      scope: 'all',
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
      system: owner,
    },
    { keepPreviousData: true }
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      listQuery.setPage(1)
    },
    [listQuery]
  )

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return
    try {
      await removeMutation.mutateAsync({ id: toDelete.id })
      toast.success(t('constants.deleted'))
    } catch (error) {
      logger.error('Delete constant failed', error)
      toast.error(t('constants.deleteFailed'))
    } finally {
      setToDelete(null)
    }
  }, [toDelete, removeMutation, t])

  const handleRestore = useCallback(
    async (constant: ConstantDTO) => {
      try {
        await restoreMutation.mutateAsync({ id: constant.id })
        toast.success(t('constants.restored'))
      } catch (error) {
        logger.error('Restore constant failed', error)
        toast.error(t('constants.restoreFailed'))
      }
    },
    [restoreMutation, t]
  )

  const actions: ConstantColumnActions = useMemo(
    () => ({
      onViewDetails: (constant) => setSheet({ mode: 'edit', constant }),
      onShare: setShareTarget,
      onDelete: setToDelete,
      onRestore: handleRestore,
    }),
    [handleRestore]
  )

  const selectedRows = useMemo(
    () => (constantsPage?.data ?? []).filter((row) => rowSelection[row.id]),
    [constantsPage, rowSelection]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])
  const anyDeleted = selectedRows.some((row) => row.deleted)
  const anyLive = selectedRows.some((row) => !row.deleted)

  // Sequential — a partial failure should stop rather than leave an unknown subset changed.
  const runBulk = useCallback(
    async (action: 'delete' | 'restore') => {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      const targets = selectedRows.filter((row) =>
        action === 'delete' ? !row.deleted : row.deleted
      )
      try {
        for (const row of targets) {
          await mutation.mutateAsync({ id: row.id })
        }
        toast.success(
          t(action === 'delete' ? 'constants.deleted' : 'constants.restored')
        )
      } catch (error) {
        logger.error('Bulk constants failed', error)
        toast.error(
          t(
            action === 'delete'
              ? 'constants.deleteFailed'
              : 'constants.restoreFailed'
          )
        )
      } finally {
        clearSelection()
      }
    },
    [selectedRows, removeMutation, restoreMutation, clearSelection, t]
  )

  const columns = useMemo(
    () => buildConstantColumns({ t, actions }),
    [t, actions]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">{t('constants.title')}</h2>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  ownerSection(t, owner, setOwner),
                  deletedSection(t, showDeleted, setShowDeleted),
                ]}
              />
              <Button size="sm" onClick={() => setSheet({ mode: 'create' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('constants.create')}
              </Button>
            </div>
          </div>

          {isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={constantsPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
            />
          )}

          <EntityTable
            columns={columns}
            page={constantsPage}
            getRowId={(constant) => constant.id}
            fetching={isFetching}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={handlePageSizeChange}
            onRowClick={(constant) => setSheet({ mode: 'edit', constant })}
            emptyIcon={<Ruler className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle={t('constants.empty.title')}
            emptyDescription={t('constants.empty.description')}
          />
        </div>
      </div>

      {sheet && (
        <ConstantSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          mode={sheet.mode}
          constant={sheet.mode === 'create' ? null : sheet.constant}
        />
      )}

      {shareTarget && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          target={{
            type: 'constant',
            id: shareTarget.id,
            name: shareTarget.name,
          }}
          isOwner={shareTarget.ownerUserId === userId}
        />
      )}

      <BulkActionBar
        count={selectedRows.length}
        onClear={clearSelection}
        canDelete={anyLive}
        canRestore={anyDeleted}
        busy={removeMutation.isPending || restoreMutation.isPending}
        onDelete={() => setConfirmBulk(true)}
        onRestore={() => runBulk('restore')}
      />

      <DeleteConfirmationDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        objectName=""
        title={t('common.bulk.deleteTitle')}
        description={t('common.bulk.deleteDescription', {
          count: selectedRows.filter((row) => !row.deleted).length,
        })}
        onDelete={() => runBulk('delete')}
      />

      <DeleteConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDelete={confirmDelete}
        objectName={toDelete?.name ?? ''}
      />
    </>
  )
}
