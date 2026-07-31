'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import { useBreadcrumbTrail } from '@/hooks/data/use-breadcrumb-trail'
import { usePreference } from '@/hooks/ui/use-preference'
import { useObjects } from '@/hooks/api/entities'
import { useAuth, useSearch } from '@/contexts'
import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  scopeSection,
  type ScopeFilterValue,
} from '@/components/filters'
import { SearchResultsBar } from '@/components/search-results-bar'
import { ViewSelector } from '@/components/view-selector'
import { ObjectColumnsView } from '@/app/objects/components/columns-view'
import {
  EntityTable,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/tables'
import { DraftRows } from '@/components/drafts'
import { useObjectDrafts } from '@/hooks/drafts'

import { ObjectBulkBar } from './components/object-bulk-bar'
import { ObjectRowPortals } from './components/object-row-portals'
import { useObjectListPage } from './components/use-object-list-page'
import { anchor } from '@/constants'
import { PageTourButton } from '@/components/onboarding/page-tour-button'

const EntitySheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.EntitySheet),
  { ssr: false }
)
const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)

export default function ObjectsPage() {
  const t = useTranslations()
  const router = useRouter()

  const [viewType, setViewType] = usePreference('objectsView')
  const [scope, setScope] = useState<ScopeFilterValue>('all')
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<ObjectListItem | null>(null)

  const { clearTrail } = useBreadcrumbTrail(undefined)
  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const { drafts, deleteDraft } = useObjectDrafts()
  const listQuery = useEntityListQuery({ scope })
  const { useList, usePrefetchDetail } = useObjects()
  // Warm the detail cache on hover so the sheet opens populated.
  const prefetchDetail = usePrefetchDetail()

  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  const { data: objectsPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: filters.pageSize,
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: filters.showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { enabled: viewType === 'table', keepPreviousData: true }
  )

  const state = useObjectListPage({
    page: objectsPage,
    onShare: setShareTarget,
  })

  const handleDoubleClick = useCallback(
    (object: ObjectListItem) => {
      clearTrail()
      router.push(`/objects/${object.id}`)
    },
    [clearTrail, router]
  )

  const resumeDraft = useCallback((id: string) => {
    setResumeDraftId(id)
    setIsAddSheetOpen(true)
  }, [])

  /**
   * Drafts pin to the FIRST page of an unfiltered, unsorted list only.
   *
   * They live in localStorage, so the server cannot search, sort or paginate them. Showing them
   * under an active search would claim they matched it; showing them on page 3 would place them
   * somewhere the sort never put them. `showDeleted` is excluded for the same reason — a draft was
   * never created, so it cannot have been deleted.
   */
  const showDrafts =
    !isSearchMode &&
    !filters.showDeleted &&
    !listQuery.query.sort &&
    (listQuery.query.page ?? 1) === 1

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <h1 className="text-2xl font-bold">{t('objects.title')}</h1>
            <PageTourButton tour="create-object" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <FilterMenu
              sections={[
                scopeSection(t, scope, setScope),
                deletedSection(t, filters.showDeleted, filters.setShowDeleted),
              ]}
              {...anchor('filters')}
            />
            <ViewSelector
              view={viewType}
              onChange={setViewType}
              {...anchor('viewSelector')}
            />
            <Button
              size="sm"
              onClick={() => setIsAddSheetOpen(true)}
              {...anchor('createObject')}
            >
              <PlusCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('objects.create')}</span>
            </Button>
          </div>
        </div>

        {isSearchMode && (
          <SearchResultsBar
            searchQuery={searchQuery}
            // The count comes from the SAME io2p response the table below renders, so the bar and
            // the rows can no longer disagree. The table paginates itself.
            resultsCount={objectsPage?.page.totalElements ?? 0}
            onClearSearch={clearSearch}
            raised={viewType === 'table' && state.selectedObjects.length > 0}
          />
        )}

        {viewType === 'table' ? (
          <EntityTable
            onRowHover={(row) => prefetchDetail(row.id)}
            columns={state.columns}
            page={objectsPage}
            getRowId={(o) => o.id}
            fetching={isFetching}
            enableRowSelection
            rowSelection={state.rowSelection}
            onRowSelectionChange={state.setRowSelection}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            onPageChange={listQuery.setPage}
            onPageSizeChange={filters.handlePageSizeChange}
            onRowDoubleClick={handleDoubleClick}
            hasPinnedRows={showDrafts && drafts.length > 0}
            pinnedRows={
              showDrafts
                ? (colSpan) => (
                    <DraftRows
                      drafts={drafts}
                      colSpan={colSpan}
                      onResume={resumeDraft}
                      onDiscard={deleteDraft}
                    />
                  )
                : undefined
            }
            emptyIcon={
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('objects.noObjectsTitle')}
            emptyDescription={t('objects.noObjectsDescription')}
            emptyAction={
              <Button size="sm" onClick={() => setIsAddSheetOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('objects.noObjectsAction')}
              </Button>
            }
          />
        ) : (
          <ObjectColumnsView
            showDeleted={filters.showDeleted}
            scope={scope}
            isRestoring={state.isRestoring}
            onViewObject={state.openDetails}
            onDelete={state.setObjectToDelete}
            onDuplicate={state.setDuplicateTarget}
            onShowQRCode={state.setQrTarget}
            onViewPassport={state.setPassportTarget}
            onCreateTemplate={state.templateFromObject.setSource}
            onRestore={state.handleRestore}
          />
        )}
      </div>

      {/* Column view has no row selection, so the bar must not claim a stale table selection. */}
      <ObjectBulkBar
        state={state}
        count={viewType === 'table' ? state.selectedObjects.length : 0}
      />

      <ObjectRowPortals state={state} />

      {shareTarget && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          target={{
            type: 'object',
            id: shareTarget.id,
            name: shareTarget.name,
          }}
          isOwner={shareTarget.createdBy === userId}
        />
      )}

      {isAddSheetOpen && (
        <EntitySheet
          open={isAddSheetOpen}
          onOpenChange={(open) => {
            setIsAddSheetOpen(open)
            // Drop the resumed id on close, or the next plain "New object" would reopen the draft.
            if (!open) setResumeDraftId(null)
          }}
          draftId={resumeDraftId}
        />
      )}
    </div>
  )
}
