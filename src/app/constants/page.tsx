'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Ruler } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { ConstantDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import {
  DeletedFilter,
  OwnerFilter,
  type OwnerFilterValue,
} from '@/components/filters'
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useConstants } from '@/hooks/api/leaves'
import { useSearch } from '@/contexts'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import {
  buildConstantColumns,
  type ConstantColumnActions,
} from './components/constant-columns'

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
  const [toDelete, setToDelete] = useState<ConstantDTO | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()

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
      onDelete: setToDelete,
      onRestore: handleRestore,
    }),
    [handleRestore]
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
              <OwnerFilter value={owner} onChange={setOwner} />
              <DeletedFilter
                showDeleted={showDeleted}
                onShowDeletedChange={setShowDeleted}
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

      <DeleteConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDelete={confirmDelete}
        objectName={toDelete?.name ?? ''}
      />
    </>
  )
}
