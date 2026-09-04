'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, Share2, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ProcessListItem } from 'io2p-client'

import { Button, FLOATING_BAR_LEVELS } from '@/components/ui'
import { FilterMenu, deletedSection, scopeSection } from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  canDelete,
  canReshare,
  permissionOf,
  useEntityListActions,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/entity-list'
import { SearchResultsBar } from '@/components/search-results-bar'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { ViewSelector } from '@/components/view-selector'
import { useProcesses } from '@/hooks/api/entities'
import { useAuth, useSearch } from '@/contexts'
import { usePreference } from '@/hooks/ui/use-preference'
import { useScopePreference } from '@/hooks/ui/use-scope-preference'
import { anchor, ENABLED_PROCESS_VIEW_TYPES } from '@/constants'

import { buildProcessColumns } from './components/process-columns'
import { ProcessFlowView } from './components/process-flow-view'
import { RelatedObjectBar } from './components/related-object-bar'
import { PageHelp } from '@/components/onboarding/page-help'
import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'

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

const PROCESS_MESSAGES = {
  deleted: 'processes.deleted',
  deleteFailed: 'processes.deleteFailed',
  restored: 'processes.restored',
  restoreFailed: 'processes.restoreFailed',
}

export default function ProcessesPage() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Arrive here from an object's Relations tab. `ref` mirrors the API parameter it drives, so the
  // URL says exactly what the request says.
  //
  // DELIBERATELY NOT under a Suspense boundary, despite `useSearchParams`. That advice is for a
  // route that would otherwise be PRERENDERED; every route here is already dynamic, so the server
  // receives the real params and nothing bails. Adding a boundary made the server render its
  // fallback while the client rendered the table — a hydration mismatch on every load, with the
  // fallback's own markup as the diff.
  const relatedObjectId = searchParams.get('ref')

  const clearRelated = useCallback(() => router.replace('/processes'), [router])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [scope, setScope, defaultScope] = useScopePreference('processScope')
  const [toShare, setToShare] = useState<ProcessListItem | null>(null)
  const [shareBundleOpen, setShareBundleOpen] = useState(false)

  const [view, setView] = usePreference('processView')
  const isTable = view === 'table'
  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))
  const { useList, useRemove, useRestore, usePrefetchDetail } = useProcesses()
  // Warm the detail cache on hover so the sheet opens populated.
  const prefetchDetail = usePrefetchDetail()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const { data: processesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: filters.pageSize,
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: filters.showDeleted ? 'include' : undefined,
      // Server-side reverse flow lookup. No `direction`, so both sides come back — the point here is
      // "everything related", where the Relations tab splits them.
      ref: relatedObjectId ?? undefined,
    },
    // The flow view sweeps its own pages; a paginated list would be a second, unused request.
    { keepPreviousData: true, enabled: isTable }
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

  // The tour opens the sheet through the page's own handler rather than by
  // synthesising a click, and closes it again when stepping back past the gate.
  useTourAction(TOUR_ACTIONS.createProcess, handleCreate)
  useTourAction(TOUR_ACTIONS.closeSheet, () => setSheetOpen(false))

  const list = useEntityListActions({
    page: processesPage,
    remove: removeMutation,
    restore: restoreMutation,
    entityName: 'process',
    messages: PROCESS_MESSAGES,
    // Not `createdBy === userId`: that would also drop rows shared with the viewer at `admin`,
    // who may delete them. Until the node sends `permission`, `permissionOf` resolves the owner
    // and returns undefined otherwise, which the ladder reads as unrestricted.
    canAct: (process) => canDelete(permissionOf(process, userId)),
  })

  // Sharing is its own rung — `canAct` above filters at `admin` for the lifecycle verbs, and a
  // process shared at `share` may be re-granted without being deletable.
  const shareableProcesses = useMemo(
    () => list.selectedRows.filter((p) => canReshare(permissionOf(p, userId))),
    [list.selectedRows, userId]
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
          onDelete: list.setToDelete,
          onRestore: list.handleRestore,
        },
      }),
    [t, openProcess, list.setToDelete, list.handleRestore, userId]
  )

  // Three bars can be up together. Each one sits above however many are open beneath it, rather than
  // every caller hardcoding a level and two of them landing on the same one.
  const selectionOpen = isTable && list.selectedRows.length > 0
  const searchOpen = isTable && isSearchMode
  const relatedLevel =
    FLOATING_BAR_LEVELS[(selectionOpen ? 1 : 0) + (searchOpen ? 1 : 0)]

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">{t('processes.title')}</h2>
              <PageHelp concept="process" tour="create-process" />
            </div>
            <div className="flex items-center gap-2">
              {/* Deleted processes are a list concern: the flow graph is about what connects to
                  what, and a soft-deleted process has no place in a chain. */}
              {isTable && (
                <FilterMenu
                  sections={[
                    scopeSection(t, scope, setScope, defaultScope),
                    deletedSection(
                      t,
                      filters.showDeleted,
                      filters.setShowDeleted
                    ),
                  ]}
                />
              )}
              <ViewSelector
                view={view}
                onChange={setView}
                options={ENABLED_PROCESS_VIEW_TYPES}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                {...anchor('processesCreate')}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('processes.create')}
              </Button>
            </div>
          </div>

          {isTable && isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={processesPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
              raised={isTable && list.selectedRows.length > 0}
            />
          )}

          {isTable ? (
            <EntityTable
              onRowHover={(row) => prefetchDetail(row.id)}
              columns={columns}
              page={processesPage}
              getRowId={(process) => process.id}
              fetching={isFetching}
              sort={listQuery.query.sort}
              onSortChange={listQuery.setSort}
              enableRowSelection
              rowSelection={list.rowSelection}
              onRowSelectionChange={list.setRowSelection}
              onPageChange={listQuery.setPage}
              onPageSizeChange={filters.handlePageSizeChange}
              pageSize={filters.pageSize}
              onRowClick={(process) => openProcess(process.id)}
              emptyIcon={
                <Workflow className="h-10 w-10 text-muted-foreground/50" />
              }
              emptyTitle={t('processes.empty.title')}
              emptyDescription={t('processes.empty.description')}
            />
          ) : (
            <ProcessFlowView
              variant={view}
              onOpenProcess={openProcess}
              relatedObjectId={relatedObjectId}
            />
          )}
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

      {relatedObjectId && (
        <RelatedObjectBar
          objectId={relatedObjectId}
          onClear={clearRelated}
          level={relatedLevel}
        />
      )}

      <BulkActionBar
        count={isTable ? list.selectedRows.length : 0}
        onClear={list.clearSelection}
        canDelete={list.anyLive}
        canRestore={list.anyDeleted}
        busy={list.isBusy}
        onDelete={() => list.setConfirmBulk(true)}
        onRestore={() => list.runBulk('restore')}
        actions={[
          {
            key: 'share',
            label: t('access.share'),
            icon: Share2,
            hidden: shareableProcesses.length === 0,
            actionable: shareableProcesses.length,
            onSelect: () => setShareBundleOpen(true),
          },
        ]}
      />

      {shareBundleOpen && (
        <ShareEditorSheet
          open
          onOpenChange={(open) => !open && setShareBundleOpen(false)}
          mode="create"
          seedResources={shareableProcesses.map((p) => ({
            type: 'process' as const,
            id: p.id,
            name: p.name,
          }))}
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

      {toShare && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setToShare(null)}
          target={{ type: 'process', id: toShare.id, name: toShare.name }}
          isOwner={toShare.createdBy === userId}
        />
      )}

      <DeleteConfirmationDialog
        open={!!list.toDelete}
        onOpenChange={(open) => !open && list.setToDelete(null)}
        onDelete={list.confirmDelete}
        objectName={list.toDelete?.name ?? ''}
      />
    </>
  )
}
