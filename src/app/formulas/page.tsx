'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, HelpCircle, FunctionSquare } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { FormulaDTO } from 'io2p-client'

import { ConceptHint, Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
  type OwnerFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  useEntityListActions,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { useFormulas } from '@/hooks/api/leaves'
import { useAuth, useSearch } from '@/contexts'
import { anchor } from '@/constants'
import { PageTourButton } from '@/components/onboarding/page-tour-button'

import {
  buildFormulaColumns,
  type FormulaColumnActions,
} from './components/formula-columns'

const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
const FormulaSheet = dynamic(
  () =>
    import('@/app/formulas/components/formula-sheet').then(
      (m) => m.FormulaSheet
    ),
  { ssr: false }
)

const FormulaReferenceDialog = dynamic(
  () =>
    import('@/app/formulas/components/formula-reference-dialog').then(
      (m) => m.FormulaReferenceDialog
    ),
  { ssr: false }
)

const FORMULA_MESSAGES = {
  deleted: 'formulas.deleted',
  deleteFailed: 'formulas.deleteFailed',
  restored: 'formulas.restored',
  restoreFailed: 'formulas.restoreFailed',
}

type SheetState =
  | { mode: 'create' }
  | { mode: 'duplicate' | 'view'; formula: FormulaDTO }

export default function FormulasPage() {
  const t = useTranslations()

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [shareTarget, setShareTarget] = useState<FormulaDTO | null>(null)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useFormulas()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  const { data: formulasPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: filters.pageSize,
      // `all` is the library view: built-ins are shared, so `mine` would hide most of them.
      scope: 'all',
      q: isSearchMode ? searchQuery : undefined,
      deleted: filters.showDeleted ? 'include' : undefined,
      system: owner,
    },
    { keepPreviousData: true }
  )

  const list = useEntityListActions({
    page: formulasPage,
    remove: removeMutation,
    restore: restoreMutation,
    entityName: 'formula',
    messages: FORMULA_MESSAGES,
  })

  const actions: FormulaColumnActions = useMemo(
    () => ({
      onViewDetails: (formula) => setSheet({ mode: 'view', formula }),
      onDuplicate: (formula) => setSheet({ mode: 'duplicate', formula }),
      onShare: setShareTarget,
      onDelete: list.setToDelete,
      onRestore: list.handleRestore,
    }),
    [list.setToDelete, list.handleRestore]
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
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">{t('formulas.title')}</h2>
              <ConceptHint label={t('concepts.formula.label')}>
                {t('concepts.formula.body')}
              </ConceptHint>
              <PageTourButton tour="write-formula" />
            </div>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  ownerSection(t, owner, setOwner),
                  deletedSection(
                    t,
                    filters.showDeleted,
                    filters.setShowDeleted
                  ),
                ]}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setReferenceOpen(true)}
                {...anchor('formulasReference')}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                {t('formulas.reference.title')}
              </Button>
              <Button
                size="sm"
                onClick={() => setSheet({ mode: 'create' })}
                {...anchor('formulasCreate')}
              >
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
              raised={list.selectedRows.length > 0}
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
            rowSelection={list.rowSelection}
            onRowSelectionChange={list.setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={filters.handlePageSizeChange}
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

      {shareTarget && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          target={{
            type: 'formula',
            id: shareTarget.id,
            name: shareTarget.name,
          }}
          isOwner={shareTarget.ownerUserId === userId}
        />
      )}

      <BulkActionBar
        count={list.selectedRows.length}
        onClear={list.clearSelection}
        canDelete={list.anyLive}
        canRestore={list.anyDeleted}
        busy={list.isBusy}
        onDelete={() => list.setConfirmBulk(true)}
        onRestore={() => list.runBulk('restore')}
      />

      <DeleteConfirmationDialog
        open={list.confirmBulk}
        onOpenChange={list.setConfirmBulk}
        objectName=""
        title={t('common.bulk.deleteTitle')}
        description={t('common.bulk.deleteDescription', {
          count: list.deletableCount,
        })}
        onDelete={() => list.runBulk('delete')}
      />

      <DeleteConfirmationDialog
        open={!!list.toDelete}
        onOpenChange={(open) => !open && list.setToDelete(null)}
        onDelete={list.confirmDelete}
        objectName={list.toDelete?.name ?? ''}
      />
    </>
  )
}
