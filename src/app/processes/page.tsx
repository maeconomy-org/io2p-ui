'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Share2, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { RowSelectionState } from '@tanstack/react-table'
import type { ProcessListItem } from 'io2p-client'

import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  scopeSection,
  type ScopeFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { ViewSelector } from '@/components/view-selector'
import { ContentSkeleton } from '@/components/skeletons'
import { useProcesses } from '@/hooks/api/entities'
import { useAuth, useSearch } from '@/contexts'
import { usePreference } from '@/hooks/ui/use-preference'
import {
  DEFAULT_TABLE_PAGE_SIZE,
  ENABLED_PROCESS_VIEW_TYPES,
} from '@/constants'
import { logger } from '@/lib/logger'

import { buildProcessColumns } from './components/process-columns'
import { ProcessFlowView } from './components/process-flow-view'

const ShareEditorSheet = dynamic(
  () =>
    import('@/app/shares/components/share-editor-sheet').then(
      (mod) => mod.ShareEditorSheet
    ),
  { ssr: false }
)
const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)

const ProcessSheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.ProcessSheet),
  { ssr: false }
)

export default function ProcessesPage() {
  const t = useTranslations()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [scope, setScope] = useState<ScopeFilterValue>('all')
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [toDelete, setToDelete] = useState<ProcessListItem | null>(null)
  const [toShare, setToShare] = useState<ProcessListItem | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkShareOpen, setBulkShareOpen] = useState(false)

  // The stored view is account-keyed, so it cannot be read until `/me` resolves. Rendering the
  // default meanwhile means showing the table and then swapping to a chart on every cold load —
  // one skeleton is better than the wrong view followed by a skeleton.
  const [view, setView, viewResolved] = usePreference('processView')
  const isTable = view === 'table'
  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore, usePrefetchDetail } = useProcesses()
  // Warm the detail cache on hover so the sheet opens populated.
  const prefetchDetail = usePrefetchDetail()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const { data: processesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
    },
    // The flow view sweeps its own pages; a paginated list would be a second, unused request. And
    // until the stored view is known, `isTable` is only a guess — firing on it would fetch a list
    // the user may never see.
    { keepPreviousData: true, enabled: viewResolved && isTable }
  )

  const openProcess = useCallback((id: string, edit = false) => {
    setSelectedId(id)
    setOpenInEditMode(edit)
    setSheetOpen(true)
  }, [])

  const handleCreate = useCallback(() => {
    setSelectedId(null)
    setOpenInEditMode(false)
    setSheetOpen(true)
  }, [])

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
      toast.success(t('processes.deleted'))
    } catch (error) {
      logger.error('Delete process failed', error)
      toast.error(t('processes.deleteFailed'))
    } finally {
      setToDelete(null)
    }
  }, [toDelete, removeMutation, t])

  const handleRestore = useCallback(
    async (process: ProcessListItem) => {
      try {
        await restoreMutation.mutateAsync({ id: process.id })
        toast.success(t('processes.restored'))
      } catch (error) {
        logger.error('Restore process failed', error)
        toast.error(t('processes.restoreFailed'))
      }
    },
    [restoreMutation, t]
  )

  const selectedProcesses = useMemo(
    () => (processesPage?.data ?? []).filter((p) => rowSelection[p.id]),
    [processesPage, rowSelection]
  )
  const clearSelection = useCallback(() => setRowSelection({}), [])

  // Sequential — a partial failure should stop rather than leave an unknown subset changed.
  const runBulk = useCallback(
    async (action: 'delete' | 'restore') => {
      const mutation = action === 'delete' ? removeMutation : restoreMutation
      const targets = selectedProcesses.filter((p) =>
        action === 'delete' ? !p.deleted : p.deleted
      )
      try {
        for (const process of targets) {
          await mutation.mutateAsync({ id: process.id })
        }
        toast.success(
          t(action === 'delete' ? 'processes.deleted' : 'processes.restored')
        )
      } catch (error) {
        logger.error('Bulk process action failed', error)
        toast.error(
          t(
            action === 'delete'
              ? 'processes.deleteFailed'
              : 'processes.restoreFailed'
          )
        )
      } finally {
        clearSelection()
      }
    },
    [selectedProcesses, removeMutation, restoreMutation, clearSelection, t]
  )

  const columns = useMemo(
    () =>
      buildProcessColumns({
        t,
        currentUserId: userId,
        actions: {
          onViewDetails: (p) => openProcess(p.id),
          onEdit: (p) => openProcess(p.id, true),
          onShare: setToShare,
          onDelete: setToDelete,
          onRestore: handleRestore,
        },
      }),
    [t, openProcess, handleRestore, userId]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">{t('processes.title')}</h2>
            <div className="flex items-center gap-2">
              {/* Deleted processes are a list concern: the flow graph is about what connects to
                  what, and a soft-deleted process has no place in a chain. */}
              {isTable && (
                <FilterMenu
                  sections={[
                    scopeSection(t, scope, setScope),
                    deletedSection(t, showDeleted, setShowDeleted),
                  ]}
                />
              )}
              <ViewSelector
                view={view}
                onChange={setView}
                options={ENABLED_PROCESS_VIEW_TYPES}
              />
              <Button size="sm" onClick={handleCreate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('processes.create')}
              </Button>
            </div>
          </div>

          {!viewResolved && <ContentSkeleton />}

          {viewResolved && isTable && isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={processesPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
            />
          )}

          {viewResolved &&
            (isTable ? (
              <EntityTable
                onRowHover={(row) => prefetchDetail(row.id)}
                columns={columns}
                page={processesPage}
                getRowId={(process) => process.id}
                fetching={isFetching}
                sort={listQuery.query.sort}
                onSortChange={listQuery.setSort}
                enableRowSelection
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                onPageChange={listQuery.setPage}
                onPageSizeChange={handlePageSizeChange}
                onRowClick={(process) => openProcess(process.id)}
                emptyIcon={
                  <Workflow className="h-10 w-10 text-muted-foreground/50" />
                }
                emptyTitle={t('processes.empty.title')}
                emptyDescription={t('processes.empty.description')}
              />
            ) : (
              <ProcessFlowView variant={view} onOpenProcess={openProcess} />
            ))}
        </div>
      </div>

      {sheetOpen && (
        <ProcessSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          processId={selectedId ?? undefined}
          initialEditing={openInEditMode}
        />
      )}

      <BulkActionBar
        count={isTable ? selectedProcesses.length : 0}
        onClear={clearSelection}
        canDelete={selectedProcesses.some((p) => !p.deleted)}
        canRestore={selectedProcesses.some((p) => p.deleted)}
        busy={removeMutation.isPending || restoreMutation.isPending}
        onDelete={() => setConfirmBulkDelete(true)}
        onRestore={() => runBulk('restore')}
        actions={[
          {
            key: 'share',
            label: t('access.share'),
            icon: Share2,
            onSelect: () => setBulkShareOpen(true),
          },
        ]}
      />

      {bulkShareOpen && (
        <ShareEditorSheet
          open
          onOpenChange={(open) => !open && setBulkShareOpen(false)}
          mode="create"
          seedResources={selectedProcesses.map((p) => ({
            type: 'process' as const,
            id: p.id,
            name: p.name,
          }))}
        />
      )}

      <DeleteConfirmationDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        objectName=""
        title={t('common.bulk.deleteTitle')}
        description={t('common.bulk.deleteDescription', {
          count: selectedProcesses.filter((p) => !p.deleted).length,
        })}
        onDelete={() => runBulk('delete')}
      />

      {toShare && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setToShare(null)}
          target={{ type: 'process', id: toShare.id, name: toShare.name }}
          isOwner={toShare.createdBy === userId}
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
