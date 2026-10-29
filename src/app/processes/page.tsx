'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, Share2, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ProcessListItem } from 'io2p-client'

import { Button } from '@/components/ui'
import { FilterMenu, deletedSection, scopeSection } from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  canDelete,
  canReshare,
  canViewGrants,
  permissionOf,
  permissionWhenKnown,
  useEntityListActions,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/entity-list'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { ViewSelector } from '@/components/view-selector'
import { useProcesses } from '@/hooks/api/entities'
import { useAuth, useListSearch } from '@/contexts'
import { SearchFilterNote } from '@/components/global-search/search-filter-note'
import {
  listSearchQuery,
  searchApplies,
  searchKey,
} from '@/components/global-search/search-parser'
import { usePreference } from '@/hooks/ui/use-preference'
import { useScopePreference } from '@/hooks/ui/use-scope-preference'
import { anchor, ENABLED_PROCESS_VIEW_TYPES } from '@/constants'

import { buildProcessColumns } from './components/process-columns'
import { ProcessFlowView } from './components/process-flow-view'
import { RelatedObjectChip } from './components/related-object-chip'
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
  // `|| null`: a bare `?ref=` reads as '' and the node refuses an empty ref with a 400.
  const relatedObjectId = searchParams.get('ref') || null

  const clearRelated = useCallback(() => router.replace('/processes'), [router])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [scope, setScope, defaultScope] = useScopePreference('processScope')
  const [toShare, setToShare] = useState<ProcessListItem | null>(null)
  const [shareBundleOpen, setShareBundleOpen] = useState(false)

  const [view, setView] = usePreference('processView')
  const isTable = view === 'table'
  const search = useListSearch('processes')
  const searching = searchApplies(search)
  const { userId, authLoading } = useAuth()

  const listQuery = useEntityListQuery({}, { resetPageOn: searchKey(search) })
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
      ...listSearchQuery(search, filters.showDeleted),
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

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">{t('processes.title')}</h2>
              <PageHelp concept="process" tour="create-process" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isTable && relatedObjectId && (
                <RelatedObjectChip
                  objectId={relatedObjectId}
                  onClear={clearRelated}
                />
              )}
              {/* Deleted processes are a list concern: the flow graph is about what connects to
                  what, and a soft-deleted process has no place in a chain. */}
              {isTable && (
                <FilterMenu
                  sections={[
                    scopeSection(t, scope, setScope, defaultScope),
                    deletedSection(
                      t,
                      filters.showDeleted,
                      filters.setShowDeleted,
                      search?.params.deleted
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

          {isTable && <SearchFilterNote search={search} />}
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
              emptyTitle={
                searching
                  ? t('search.noResultsTitle')
                  : t('processes.empty.title')
              }
              emptyDescription={
                searching
                  ? t('search.noResultsDescription')
                  : t('processes.empty.description')
              }
            />
          ) : (
            <ProcessFlowView
              variant={view}
              onOpenProcess={openProcess}
              relatedObjectId={relatedObjectId}
              onClearRelated={clearRelated}
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
            permission: permissionOf(p, userId),
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
          // The node's own verdict, not ownership: an `admin` grantee may read this list, and
          // the owner is only the commonest way to hold admin. Loading-SAFE, like the row action
          // that opened this sheet: `userId` resolves after the rows do, and for those frames an
          // unresolved viewer would otherwise fall through to the permissive default and fire a
          // request on someone else's process.
          canViewGrants={canViewGrants(
            permissionWhenKnown(toShare, userId, authLoading)
          )}
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
