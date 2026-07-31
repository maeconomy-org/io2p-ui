'use client'

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText, FolderTree, Share2 } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { ObjectListItem } from 'io2p-client'

import { useBreadcrumbTrail, usePreference } from '@/hooks'
import { useObjects } from '@/hooks/api/entities'
import { useAuth, useSearch } from '@/contexts'
import { logger } from '@/lib'
import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  scopeSection,
  type ScopeFilterValue,
} from '@/components/filters'
import { SearchResultsBar } from '@/components/search-results-bar'
import { ViewSelector } from '@/components/view-selector'
import { ObjectColumnsView } from '@/components/object-columns-view'
import {
  BulkActionBar,
  EntityTable,
  useEntityListQuery,
} from '@/components/tables'
import { DeleteConfirmationDialog } from '@/components/modals'
import { DraftRows } from '@/components/drafts'
import { useObjectDrafts } from '@/hooks/drafts'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

import { buildObjectColumns } from './components/object-columns'
import { useCreateTemplateFromObject } from './components/use-create-template-from-object'

const EntitySheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.EntitySheet),
  { ssr: false }
)
const DuplicateObjectsSheet = dynamic(
  () =>
    import('@/components/duplicate-objects/duplicate-objects-sheet').then(
      (mod) => mod.DuplicateObjectsSheet
    ),
  { ssr: false }
)
const ProductPassportSheet = dynamic(
  () => import('@/components/passport').then((mod) => mod.ProductPassportSheet),
  { ssr: false }
)
const QRCodeModal = dynamic(
  () =>
    import('@/components/modals/qr-code-modal').then((mod) => mod.QRCodeModal),
  { ssr: false }
)
const ShareEditorSheet = dynamic(
  () =>
    import('@/app/shares/components/share-editor-sheet').then(
      (mod) => mod.ShareEditorSheet
    ),
  { ssr: false }
)
const BulkParentDialog = dynamic(
  () =>
    import('./components/bulk-parent-dialog').then(
      (mod) => mod.BulkParentDialog
    ),
  { ssr: false }
)
const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
// Also driver.js — only ever runs once, on a first login.
const InitialLoginTour = dynamic(
  () => import('@/components/onboarding/initial-login-tour'),
  { ssr: false }
)

const TemplateCreationDialog = dynamic(
  () => import('@/components/modals').then((mod) => mod.TemplateCreationDialog),
  { ssr: false }
)

const idOf = (o: ObjectListItem) => o.id

function ObjectsPageContent() {
  const t = useTranslations()
  const router = useRouter()
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [viewType, setViewType] = usePreference('objectsView')
  const [showDeleted, setShowDeleted] = useState(false)
  const [scope, setScope] = useState<ScopeFilterValue>('all')

  const [selectedObject, setSelectedObject] = useState<ObjectListItem | null>(
    null
  )
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)

  const [copyTarget, setCopyTarget] = useState<ObjectListItem | null>(null)
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [qrTarget, setQrTarget] = useState<ObjectListItem | null>(null)
  const [passportTarget, setPassportTarget] = useState<ObjectListItem | null>(
    null
  )
  const [objectToDelete, setObjectToDelete] = useState<ObjectListItem | null>(
    null
  )
  const [shareTarget, setShareTarget] = useState<ObjectListItem | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkParentOpen, setBulkParentOpen] = useState(false)
  const [bulkShareOpen, setBulkShareOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null)

  const { clearTrail } = useBreadcrumbTrail(undefined)
  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const templateFromObject = useCreateTemplateFromObject()
  const templateSource = templateFromObject.source
  const setTemplateSource = templateFromObject.setSource

  const { drafts, deleteDraft } = useObjectDrafts()
  const listQuery = useEntityListQuery({ scope })
  const { useList, useRemove, useRestore, usePrefetchDetail } = useObjects()
  // Warm the detail cache on hover so the sheet opens populated.
  const prefetchDetail = usePrefetchDetail()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const { data: objectsPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { enabled: viewType === 'table', keepPreviousData: true }
  )

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  )
  const selectedObjects = useMemo(
    () => (objectsPage?.data ?? []).filter((o) => rowSelection[o.id]),
    [objectsPage, rowSelection]
  )
  const anySelectedDeleted = selectedObjects.some((o) => o.deleted)
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const runBulkDelete = useCallback(async () => {
    try {
      await Promise.all(
        selectedIds.map((id) => removeMutation.mutateAsync({ id }))
      )
    } catch (error) {
      logger.error('Bulk delete error:', error)
    } finally {
      setConfirmBulkDelete(false)
      clearSelection()
    }
  }, [selectedIds, removeMutation, clearSelection])

  const runBulkRestore = useCallback(async () => {
    try {
      await Promise.all(
        selectedIds.map((id) => restoreMutation.mutateAsync({ id }))
      )
    } catch (error) {
      logger.error('Bulk restore error:', error)
    } finally {
      clearSelection()
    }
  }, [selectedIds, restoreMutation, clearSelection])

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      listQuery.setPage(1)
    },
    [listQuery]
  )

  const openDetails = useCallback((object: ObjectListItem) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }, [])

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
    !showDeleted &&
    !listQuery.query.sort &&
    (listQuery.query.page ?? 1) === 1

  const handleDoubleClick = useCallback(
    (object: ObjectListItem) => {
      clearTrail()
      router.push(`/objects/${idOf(object)}`)
    },
    [clearTrail, router]
  )

  const confirmDelete = useCallback(async () => {
    if (!objectToDelete) return
    try {
      await removeMutation.mutateAsync({ id: objectToDelete.id })
    } catch (error) {
      logger.error('Delete object error:', error)
    } finally {
      setObjectToDelete(null)
    }
  }, [objectToDelete, removeMutation])

  const handleRestore = useCallback(
    async (object: ObjectListItem) => {
      try {
        await restoreMutation.mutateAsync({ id: object.id })
      } catch (error) {
        logger.error('Restore object error:', error)
      }
    },
    [restoreMutation]
  )

  const columns = useMemo(
    () =>
      buildObjectColumns({
        t,
        enableSelection: true,
        isDeleting: removeMutation.isPending,
        isRestoring: restoreMutation.isPending,
        actions: {
          onViewDetails: openDetails,
          onShowQRCode: setQrTarget,
          onViewPassport: setPassportTarget,
          onDuplicate: setCopyTarget,
          onCreateTemplate: setTemplateSource,
          onShare: setShareTarget,
          onDelete: setObjectToDelete,
          onRestore: handleRestore,
        },
      }),
    [
      t,
      setTemplateSource,
      removeMutation.isPending,
      restoreMutation.isPending,
      openDetails,
      handleRestore,
    ]
  )

  return (
    <div className="container mx-auto p-4">
      <InitialLoginTour />
      <div className="flex flex-col">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="shrink-0 text-2xl font-bold">{t('objects.title')}</h1>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <FilterMenu
              sections={[
                scopeSection(t, scope, setScope),
                deletedSection(t, showDeleted, setShowDeleted),
              ]}
              data-tour="filters"
            />
            <ViewSelector
              view={viewType}
              onChange={setViewType}
              data-tour="view-selector"
            />
            <Button
              size="sm"
              onClick={() => setIsAddSheetOpen(true)}
              data-tour="create-object"
            >
              <PlusCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('objects.create')}</span>
            </Button>
          </div>
        </div>

        {isSearchMode && (
          <SearchResultsBar
            searchQuery={searchQuery}
            // The count now comes from the SAME io2p response the table below renders, so the bar
            // and the rows can no longer disagree. The table paginates itself.
            resultsCount={objectsPage?.page.totalElements ?? 0}
            onClearSearch={clearSearch}
          />
        )}

        {viewType === 'table' ? (
          <EntityTable
            onRowHover={(row) => prefetchDetail(row.id)}
            columns={columns}
            page={objectsPage}
            getRowId={(o) => o.id}
            fetching={isFetching}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            onPageChange={listQuery.setPage}
            onPageSizeChange={handlePageSizeChange}
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
          />
        ) : (
          <ObjectColumnsView
            showDeleted={showDeleted}
            scope={scope}
            isRestoring={restoreMutation.isPending}
            onViewObject={openDetails}
            onDelete={setObjectToDelete}
            onDuplicate={setCopyTarget}
            onShowQRCode={setQrTarget}
            onViewPassport={setPassportTarget}
            onCreateTemplate={setTemplateSource}
            onRestore={handleRestore}
          />
        )}
      </div>

      {/* Floating, not inline: a bar in the flow pushes the rows down at the moment the user is
          clicking their checkboxes. */}
      <BulkActionBar
        count={viewType === 'table' ? selectedObjects.length : 0}
        onClear={clearSelection}
        canDelete={selectedObjects.some((o) => !o.deleted)}
        canRestore={anySelectedDeleted}
        busy={removeMutation.isPending || restoreMutation.isPending}
        onDelete={() => setConfirmBulkDelete(true)}
        onRestore={runBulkRestore}
        actions={[
          {
            key: 'share',
            label: t('access.share'),
            icon: Share2,
            onSelect: () => setBulkShareOpen(true),
          },
          {
            key: 'set-parent',
            label: t('objects.bulk.setParent'),
            icon: FolderTree,
            onSelect: () => setBulkParentOpen(true),
          },
        ]}
      />

      <BulkParentDialog
        open={bulkParentOpen}
        onOpenChange={setBulkParentOpen}
        objects={selectedObjects}
        onDone={clearSelection}
      />

      {/* Bundling a selection is exactly what a Share IS, so the editor opens seeded with it and
          the user can add more before saving. */}
      {bulkShareOpen && (
        <ShareEditorSheet
          open
          onOpenChange={(open) => !open && setBulkShareOpen(false)}
          mode="create"
          seedResources={selectedObjects.map((o) => ({
            type: 'object' as const,
            id: o.id,
            name: o.name,
          }))}
        />
      )}

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

      {isObjectSheetOpen && (
        <EntitySheet
          open={isObjectSheetOpen}
          onOpenChange={setIsObjectSheetOpen}
          entityId={selectedObject ? idOf(selectedObject) : undefined}
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

      {qrTarget && (
        <QRCodeModal
          isOpen={!!qrTarget}
          onClose={() => setQrTarget(null)}
          uuid={idOf(qrTarget)}
          objectName={qrTarget.name}
        />
      )}

      {passportTarget && (
        <ProductPassportSheet
          isOpen={!!passportTarget}
          onClose={() => setPassportTarget(null)}
          uuid={idOf(passportTarget)}
          object={passportTarget}
        />
      )}

      {templateSource && (
        <TemplateCreationDialog
          open={!!templateSource}
          onOpenChange={(open) => !open && setTemplateSource(null)}
          initialData={templateFromObject.initialData}
          onConfirm={templateFromObject.confirm}
          isCreating={templateFromObject.isCreating}
        />
      )}

      {isCopySheetOpen && copyTarget && (
        <DuplicateObjectsSheet
          open={isCopySheetOpen}
          onOpenChange={setIsCopySheetOpen}
          preselectedObjects={[
            {
              uuid: idOf(copyTarget),
              name: copyTarget.name ?? '',
              hasChildren: (copyTarget.childCount ?? 0) > 0,
              childCount: copyTarget.childCount ?? 0,
            },
          ]}
        />
      )}

      {objectToDelete && (
        <DeleteConfirmationDialog
          open={!!objectToDelete}
          onOpenChange={(open) => !open && setObjectToDelete(null)}
          objectName={objectToDelete.name}
          onDelete={confirmDelete}
        />
      )}

      {confirmBulkDelete && (
        <DeleteConfirmationDialog
          open={confirmBulkDelete}
          onOpenChange={(open) => !open && setConfirmBulkDelete(false)}
          objectName={`${selectedIds.length} ${t('objects.title')}`}
          onDelete={runBulkDelete}
        />
      )}
    </div>
  )
}

export default function ObjectsPage() {
  return <ObjectsPageContent />
}
