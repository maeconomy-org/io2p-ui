'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { ProcessDTO } from 'io2p-client'

import { Button } from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/modals'
import { ViewSelector } from '@/components/view-selector'
import { ContentSkeleton } from '@/components/skeletons'
import { useProcesses } from '@/hooks/api/entities'
import { useSearch } from '@/contexts'
import { usePreference } from '@/hooks'
import {
  DEFAULT_TABLE_PAGE_SIZE,
  ENABLED_PROCESS_VIEW_TYPES,
} from '@/constants'
import { logger } from '@/lib'

import { buildProcessColumns } from './components/process-columns'
import { ProcessFlowView } from './components/process-flow-view'

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
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [toDelete, setToDelete] = useState<ProcessDTO | null>(null)

  // The stored view is account-keyed, so it cannot be read until `/me` resolves. Rendering the
  // default meanwhile means showing the table and then swapping to a chart on every cold load —
  // one skeleton is better than the wrong view followed by a skeleton.
  const [view, setView, viewResolved] = usePreference('processView')
  const isTable = view === 'table'
  const { isSearchMode, searchQuery, clearSearch } = useSearch()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useProcesses()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const { data: processesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope: 'all',
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
    async (process: ProcessDTO) => {
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

  const columns = useMemo(
    () =>
      buildProcessColumns({
        t,
        actions: {
          onViewDetails: (p) => openProcess(p.id),
          onEdit: (p) => openProcess(p.id, true),
          onDelete: setToDelete,
          onRestore: handleRestore,
        },
      }),
    [t, openProcess, handleRestore]
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
                <DeletedFilter
                  showDeleted={showDeleted}
                  onShowDeletedChange={setShowDeleted}
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
                columns={columns}
                page={processesPage}
                getRowId={(process) => process.id}
                fetching={isFetching}
                sort={listQuery.query.sort}
                onSortChange={listQuery.setSort}
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

      <DeleteConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDelete={confirmDelete}
        objectName={toDelete?.name ?? ''}
      />
    </>
  )
}
