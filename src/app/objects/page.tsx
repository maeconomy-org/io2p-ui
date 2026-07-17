'use client'

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText, Trash2, RotateCcw, X } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { ObjectDTO } from 'io2p-client'

import { useBreadcrumbTrail, useViewData, usePreference } from '@/hooks'
import { useObjects } from '@/hooks/api/entities'
import { useSearch } from '@/contexts'
import { logger } from '@/lib'
import ProtectedRoute from '@/components/protected-route'
import InitialLoginTour from '@/components/onboarding/initial-login-tour'
import { Button } from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { SearchResultsBar } from '@/components/search-results-bar'
import { ViewSelector } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { DeleteConfirmationDialog } from '@/components/modals'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { useObjectOperations } from '@/components/object-sheets/hooks/use-object-operations'

import { buildObjectColumns } from './components/object-columns'

const ObjectDetailsSheet = dynamic(
  () =>
    import('@/components/object-sheets/object-details-sheet').then(
      (mod) => mod.ObjectDetailsSheet
    ),
  { ssr: false }
)
const ObjectAddSheet = dynamic(
  () =>
    import('@/components/object-sheets/object-add-sheet').then(
      (mod) => mod.ObjectAddSheet
    ),
  { ssr: false }
)
const CopyObjectsSheet = dynamic(
  () =>
    import('@/components/object-sheets/copy-objects-sheet').then(
      (mod) => mod.CopyObjectsSheet
    ),
  { ssr: false }
)
const ProductPassportSheet = dynamic(
  () =>
    import('@/components/object-sheets').then(
      (mod) => mod.ProductPassportSheet
    ),
  { ssr: false }
)
const QRCodeModal = dynamic(
  () =>
    import('@/components/modals/qr-code-modal').then((mod) => mod.QRCodeModal),
  { ssr: false }
)
const TemplateCreationDialog = dynamic(
  () => import('@/components/modals').then((mod) => mod.TemplateCreationDialog),
  { ssr: false }
)

// During the table→columns migration the still-old columns view yields rows keyed by `uuid`;
// the migrated table yields `ObjectDTO.id`. Shared sheets/modals fetch by that id either way.
const idOf = (o: { id?: string; uuid?: string }) => o.id ?? o.uuid ?? ''

function ObjectsPageContent() {
  const t = useTranslations()
  const router = useRouter()
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [viewType, setViewType] = usePreference('objectsView')
  const [showDeleted, setShowDeleted] = useState(false)

  const [selectedObject, setSelectedObject] = useState<ObjectDTO | null>(null)
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)

  const [copyTarget, setCopyTarget] = useState<ObjectDTO | null>(null)
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [qrTarget, setQrTarget] = useState<ObjectDTO | null>(null)
  const [passportTarget, setPassportTarget] = useState<ObjectDTO | null>(null)
  const [templateSource, setTemplateSource] = useState<ObjectDTO | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [objectToDelete, setObjectToDelete] = useState<ObjectDTO | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const { clearTrail } = useBreadcrumbTrail(undefined)
  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  const { createObject: createTemplate } = useObjectOperations({
    isEditing: false,
    isTemplate: true,
  })

  const listQuery = useEntityListQuery({ scope: 'all' })
  const { useList, useRemove, useRestore } = useObjects()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const { data: objectsPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: pageSize,
      scope: 'all',
      q: isSearchMode ? searchQuery : undefined,
      deleted: showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { enabled: viewType === 'table', keepPreviousData: true }
  )

  // Columns (Miller) view still runs on the old adapter until it migrates next.
  const viewData = useViewData({
    viewType,
    showDeleted,
    tablePageSize: pageSize,
  })

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

  const openDetails = useCallback((object: ObjectDTO) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }, [])

  const handleDoubleClick = useCallback(
    (object: ObjectDTO) => {
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
    async (object: ObjectDTO) => {
      try {
        await restoreMutation.mutateAsync({ id: object.id })
      } catch (error) {
        logger.error('Restore object error:', error)
      }
    },
    [restoreMutation]
  )

  const getInitialTemplateData = (source: ObjectDTO | null) => {
    if (!source)
      return { name: '', abbreviation: '', version: '1.0', description: '' }
    return {
      name: `${source.name} Template`,
      abbreviation: '',
      version: '1.0',
      description: `Template created from ${source.name}`,
    }
  }

  const handleConfirmTemplateCreation = async (templateData: {
    name: string
    abbreviation: string
    version: string
    description: string
  }) => {
    if (!templateSource) return
    setIsCreatingTemplate(true)
    try {
      await createTemplate({
        ...templateData,
        properties:
          templateSource.properties?.map((prop) => ({
            key: prop.key,
            label: prop.label || prop.key,
            type: 'string',
            values:
              prop.values?.map(() => ({
                value: 'Variable',
                valueTypeCast: 'string',
                files: [],
              })) ?? [],
            files: [],
          })) ?? [],
        files: [],
        parents: [],
      })
      setTemplateSource(null)
    } catch (error) {
      logger.error('Error creating template:', error)
    } finally {
      setIsCreatingTemplate(false)
    }
  }

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
          onDelete: setObjectToDelete,
          onRestore: handleRestore,
        },
      }),
    [
      t,
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
            <DeletedFilter
              showDeleted={showDeleted}
              onShowDeletedChange={setShowDeleted}
              label={t('objects.showDeleted')}
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
            resultsCount={searchViewResults.length}
            pagination={searchPagination ?? undefined}
            onClearSearch={clearSearch}
          />
        )}

        {viewType === 'table' && selectedIds.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {t('objects.bulk.selected', {
                selected: selectedIds.length,
                total: objectsPage?.page.totalElements ?? selectedIds.length,
              })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {anySelectedDeleted && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={runBulkRestore}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('objects.bulk.restoreSelected')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('objects.bulk.deleteSelected')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                aria-label={t('common.cancel')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {viewType === 'table' ? (
          <EntityTable
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
            emptyIcon={
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('objects.noObjectsTitle')}
            emptyDescription={t('objects.noObjectsDescription')}
          />
        ) : (
          <ObjectViewContainer
            viewType={viewType}
            viewData={viewData}
            onViewObject={openDetails}
            onObjectDoubleClick={handleDoubleClick}
            onDuplicate={setCopyTarget}
            showDeleted={showDeleted}
            onShowQRCode={setQrTarget}
            onViewPassport={setPassportTarget}
            onCreateTemplate={setTemplateSource}
            onRestore={handleRestore}
            isRestoring={restoreMutation.isPending}
          />
        )}
      </div>

      <ObjectDetailsSheet
        isOpen={isObjectSheetOpen}
        onClose={() => setIsObjectSheetOpen(false)}
        object={selectedObject}
        uuid={selectedObject ? idOf(selectedObject) : undefined}
        isDeleted={selectedObject?.deleted ?? false}
      />

      <ObjectAddSheet
        isOpen={isAddSheetOpen}
        draftId={null}
        onClose={() => setIsAddSheetOpen(false)}
      />

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
          initialData={getInitialTemplateData(templateSource)}
          onConfirm={handleConfirmTemplateCreation}
          isCreating={isCreatingTemplate}
        />
      )}

      {isCopySheetOpen && copyTarget && (
        <CopyObjectsSheet
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
  return (
    <ProtectedRoute>
      <ObjectsPageContent />
    </ProtectedRoute>
  )
}
