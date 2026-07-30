'use client'

import { useState, useCallback, useMemo } from 'react'
import type { RowSelectionState } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { PlusCircle, HelpCircle, FunctionSquare } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { FormulaDTO } from 'io2p-client'

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
import { useFormulas } from '@/hooks/api/leaves'
import { useSearch } from '@/contexts'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { logger } from '@/lib'

import {
  buildFormulaColumns,
  type FormulaColumnActions,
} from './components/formula-columns'

const FormulaSheet = dynamic(
  () =>
    import('@/components/formulas/formula-sheet').then((m) => m.FormulaSheet),
  { ssr: false }
)

const FormulaReferenceDialog = dynamic(
  () =>
    import('@/components/formulas/formula-reference-dialog').then(
      (m) => m.FormulaReferenceDialog
    ),
  { ssr: false }
)

type SheetState =
  | { mode: 'create' }
  | { mode: 'duplicate' | 'view'; formula: FormulaDTO }

export default function FormulasPage() {
  const t = useTranslations()

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [toDelete, setToDelete] = useState<FormulaDTO | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useFormulas()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const { data: formulasPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      // `all` is the library view: built-ins are shared, so `mine` would hide most of them.
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
      toast.success(t('formulas.deleted'))
    } catch (error) {
      logger.error('Delete formula failed', error)
      toast.error(t('formulas.deleteFailed'))
    } finally {
      setToDelete(null)
    }
  }, [toDelete, removeMutation, t])

  const handleRestore = useCallback(
    async (formula: FormulaDTO) => {
      try {
        await restoreMutation.mutateAsync({ id: formula.id })
        toast.success(t('formulas.restored'))
      } catch (error) {
        logger.error('Restore formula failed', error)
        toast.error(t('formulas.restoreFailed'))
      }
    },
    [restoreMutation, t]
  )

  const actions: FormulaColumnActions = useMemo(
    () => ({
      onViewDetails: (formula) => setSheet({ mode: 'view', formula }),
      onDuplicate: (formula) => setSheet({ mode: 'duplicate', formula }),
      onDelete: setToDelete,
      onRestore: handleRestore,
    }),
    [handleRestore]
  )

  const selectedRows = useMemo(
    () => (formulasPage?.data ?? []).filter((row) => rowSelection[row.id]),
    [formulasPage, rowSelection]
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
          t(action === 'delete' ? 'formulas.deleted' : 'formulas.restored')
        )
      } catch (error) {
        logger.error('Bulk formulas failed', error)
        toast.error(
          t(
            action === 'delete'
              ? 'formulas.deleteFailed'
              : 'formulas.restoreFailed'
          )
        )
      } finally {
        clearSelection()
      }
    },
    [selectedRows, removeMutation, restoreMutation, clearSelection, t]
  )

  const columns = useMemo(
    () => buildFormulaColumns({ t, actions }),
    [t, actions]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">{t('formulas.title')}</h2>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  ownerSection(t, owner, setOwner),
                  deletedSection(t, showDeleted, setShowDeleted),
                ]}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setReferenceOpen(true)}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                {t('formulas.reference.title')}
              </Button>
              <Button size="sm" onClick={() => setSheet({ mode: 'create' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('formulas.create')}
              </Button>
            </div>
          </div>

          {isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={formulasPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
            />
          )}

          <EntityTable
            columns={columns}
            page={formulasPage}
            getRowId={(formula) => formula.id}
            fetching={isFetching}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={handlePageSizeChange}
            onRowClick={(formula) => setSheet({ mode: 'view', formula })}
            emptyIcon={
              <FunctionSquare className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('formulas.empty.title')}
            emptyDescription={t('formulas.empty.description')}
          />
        </div>
      </div>

      {sheet && (
        <FormulaSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          mode={sheet.mode}
          formula={sheet.mode === 'create' ? null : sheet.formula}
        />
      )}

      <FormulaReferenceDialog
        open={referenceOpen}
        onOpenChange={setReferenceOpen}
      />

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
