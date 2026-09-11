'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Ruler, Share2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ConstantDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
  scopeSection,
  type OwnerFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  canWriteLibraryItem,
  useEntityListActions,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/entity-list'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { useConstants } from '@/hooks/api/leaves'
import { useScopePreference } from '@/hooks/ui/use-scope-preference'
import { useAuth, useSearch } from '@/contexts'
import { anchor } from '@/constants'

import {
  buildConstantColumns,
  type ConstantColumnActions,
} from './components/constant-columns'
import { PageHelp } from '@/components/onboarding/page-help'
import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'

const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
const LibraryBulkShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.LibraryBulkShareSheet),
  { ssr: false }
)
const ConstantSheet = dynamic(
  () =>
    import('@/app/constants/components/constant-sheet').then(
      (m) => m.ConstantSheet
    ),
  { ssr: false }
)

type SheetState = { mode: 'create' } | { mode: 'edit'; constant: ConstantDTO }

const CONSTANT_MESSAGES = {
  deleted: 'constants.deleted',
  deleteFailed: 'constants.deleteFailed',
  restored: 'constants.restored',
  restoreFailed: 'constants.restoreFailed',
}

export default function ConstantsPage() {
  const t = useTranslations()

  const [sheet, setSheet] = useState<SheetState | null>(null)

  useTourAction(TOUR_ACTIONS.createConstant, () => setSheet({ mode: 'create' }))
  useTourAction(TOUR_ACTIONS.closeSheet, () => setSheet(null))
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [scope, setScope, defaultScope] = useScopePreference('constantScope')
  const [shareTarget, setShareTarget] = useState<ConstantDTO | null>(null)
  const [bulkShareOpen, setBulkShareOpen] = useState(false)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useConstants()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  const { data: constantsPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: filters.pageSize,
      // `all`: built-ins are shared, so `mine` would hide most of the library.
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: filters.showDeleted ? 'include' : undefined,
      system: owner,
    },
    { keepPreviousData: true }
  )

  const list = useEntityListActions({
    page: constantsPage,
    remove: removeMutation,
    restore: restoreMutation,
    entityName: 'constant',
    canAct: (row) => canWriteLibraryItem(row, userId),
    messages: CONSTANT_MESSAGES,
  })

  const actions: ConstantColumnActions = useMemo(
    () => ({
      onViewDetails: (constant) => setSheet({ mode: 'edit', constant }),
      onShare: setShareTarget,
      onDelete: list.setToDelete,
      onRestore: list.handleRestore,
    }),
    [list.setToDelete, list.handleRestore]
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
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">{t('constants.title')}</h2>
              <PageHelp concept="constant" tour="define-constant" />
            </div>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  scopeSection(t, scope, setScope, defaultScope),
                  ownerSection(t, owner, setOwner),
                  deletedSection(
                    t,
                    filters.showDeleted,
                    filters.setShowDeleted
                  ),
                ]}
              />
              <Button
                size="sm"
                onClick={() => setSheet({ mode: 'create' })}
                {...anchor('constantsCreate')}
              >
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
              raised={list.selectedRows.length > 0}
            />
          )}

          <div {...anchor('constantsList')}>
            <EntityTable
              columns={columns}
              page={constantsPage}
              getRowId={(constant) => constant.id}
              fetching={isFetching}
              sort={listQuery.query.sort}
              onSortChange={listQuery.setSort}
              enableRowSelection
              rowSelection={list.rowSelection}
              onRowSelectionChange={list.setRowSelection}
              onPageChange={listQuery.setPage}
              onPageSizeChange={filters.handlePageSizeChange}
              pageSize={filters.pageSize}
              onRowClick={(constant) => setSheet({ mode: 'edit', constant })}
              emptyIcon={
                <Ruler className="h-10 w-10 text-muted-foreground/50" />
              }
              emptyTitle={t('constants.empty.title')}
              emptyDescription={t('constants.empty.description')}
            />
          </div>
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
        count={list.selectedRows.length}
        onClear={list.clearSelection}
        canDelete={list.anyLive}
        canRestore={list.anyDeleted}
        busy={list.isBusy}
        onDelete={() => list.setConfirmBulk(true)}
        onRestore={() => list.runBulk('restore')}
        actions={[
          {
            key: 'share',
            // A bundle needs `share` on EVERY resource or the node refuses the whole call, so a
            // selection mixing yours with someone else's would fail as a unit.
            label: t('access.share'),
            icon: Share2,
            hidden: list.actionableRows.length === 0,
            actionable: list.actionableRows.length,
            onSelect: () => setBulkShareOpen(true),
          },
        ]}
      />

      {bulkShareOpen && (
        <LibraryBulkShareSheet
          open
          onOpenChange={(open) => !open && setBulkShareOpen(false)}
          resources={list.actionableRows.map((row) => ({
            type: 'constant' as const,
            id: row.id,
            name: row.name,
          }))}
          onDone={list.clearSelection}
        />
      )}

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
