'use client'

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, Copy, FileText, Trash2, RotateCcw, X } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { ObjectDTO } from 'io2p-client'

import { useBreadcrumbTrail } from '@/hooks'
import { useObjects } from '@/hooks/api/entities'
import { logger } from '@/lib'
import { Button } from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { ObjectBreadcrumb } from '@/components/object-breadcrumb'
import { EntityTable, useEntityListQuery } from '@/components/tables'
import { DeleteConfirmationDialog } from '@/components/modals'
import ProtectedRoute from '@/components/protected-route'
import { ContentSkeleton } from '@/components/skeletons'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

import { buildObjectColumns } from '../components/object-columns'
import { useCreateTemplateFromObject } from '../components/use-create-template-from-object'

const EntitySheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.EntitySheet),
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

function ObjectChildrenPageContent() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [showDeleted, setShowDeleted] = useState(false)

  const [selectedObject, setSelectedObject] = useState<ObjectDTO | null>(null)
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<ObjectDTO | null>(null)
  const [isCopyHereOpen, setIsCopyHereOpen] = useState(false)
  const [qrTarget, setQrTarget] = useState<ObjectDTO | null>(null)
  const [passportTarget, setPassportTarget] = useState<ObjectDTO | null>(null)
  const [objectToDelete, setObjectToDelete] = useState<ObjectDTO | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const { ancestors, pushAncestor, navigateToAncestor, clearTrail } =
    useBreadcrumbTrail(parentUuid)

  const { useGet, useList, useRemove, useRestore } = useObjects()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const templateFromObject = useCreateTemplateFromObject()
  const templateSource = templateFromObject.source
  const setTemplateSource = templateFromObject.setSource

  const { data: parentObject, isLoading: parentLoading } = useGet(parentUuid)

  const listQuery = useEntityListQuery()
  const { data: childrenPage, isFetching } = useList(
    {
      ...listQuery.query,
      parent: parentUuid,
      size: pageSize,
      deleted: showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { enabled: !!parentUuid, keepPreviousData: true }
  )

  const totalElements = childrenPage?.page.totalElements ?? 0

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  )
  const selectedObjects = useMemo(
    () => (childrenPage?.data ?? []).filter((o) => rowSelection[o.id]),
    [childrenPage, rowSelection]
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
      if (parentObject) {
        pushAncestor({ uuid: parentUuid, name: parentObject.name })
      }
      router.push(`/objects/${object.id}`)
    },
    [parentObject, parentUuid, pushAncestor, router]
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

  if (parentLoading) {
    return <ContentSkeleton />
  }

  if (!parentObject) {
    return (
      <div className="container mx-auto px-4">
        <div className="flex h-40 items-center justify-center">
          <p>{t('objects.childrenPage.parentNotFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col space-y-4">
        <ObjectBreadcrumb
          currentObject={{ uuid: parentUuid, name: parentObject.name }}
          ancestors={ancestors}
          onNavigateToAncestor={navigateToAncestor}
          onNavigateToRoot={clearTrail}
        />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{parentObject.name}</h1>
              <p className="text-sm font-medium text-muted-foreground">
                (
                {t('objects.childrenPage.childrenCount', {
                  count: totalElements,
                })}
                )
              </p>
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {parentObject.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DeletedFilter
              showDeleted={showDeleted}
              onShowDeletedChange={setShowDeleted}
              label={t('objects.showDeleted')}
              data-tour="filters"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCopyHereOpen(true)}
              data-testid="page-header-copy-button"
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('objects.duplicate.copyHere')}
            </Button>
            <Button size="sm" onClick={() => setIsAddSheetOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('objects.childrenPage.addChild')}
            </Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {t('objects.bulk.selected', {
                selected: selectedIds.length,
                total: totalElements || selectedIds.length,
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

        <EntityTable
          columns={columns}
          page={childrenPage}
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
          emptyTitle={t('objects.childrenPage.noChildrenTitle')}
          emptyDescription={t('objects.childrenPage.noChildrenDescription')}
        />
      </div>

      {isObjectSheetOpen && (
        <EntitySheet
          open={isObjectSheetOpen}
          onOpenChange={setIsObjectSheetOpen}
          entityId={selectedObject?.id}
        />
      )}

      {/* "Add child" creates the CHILD with this page's object as its parent — io2p hangs the
          edge off the child, so there is nothing to PATCH on the parent. */}
      {isAddSheetOpen && (
        <EntitySheet
          open={isAddSheetOpen}
          onOpenChange={setIsAddSheetOpen}
          defaultParentIds={[parentUuid]}
          defaultParentNames={{ [parentUuid]: parentObject.name }}
        />
      )}

      {qrTarget && (
        <QRCodeModal
          isOpen={!!qrTarget}
          onClose={() => setQrTarget(null)}
          uuid={qrTarget.id}
          objectName={qrTarget.name}
        />
      )}

      {passportTarget && (
        <ProductPassportSheet
          isOpen={!!passportTarget}
          onClose={() => setPassportTarget(null)}
          uuid={passportTarget.id}
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

      {isCopyHereOpen && (
        <CopyObjectsSheet
          open={isCopyHereOpen}
          onOpenChange={setIsCopyHereOpen}
          defaultParentUuid={parentUuid}
        />
      )}

      {copyTarget && (
        <CopyObjectsSheet
          open={!!copyTarget}
          onOpenChange={(open) => !open && setCopyTarget(null)}
          preselectedObjects={[
            {
              uuid: copyTarget.id,
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

export default function ObjectChildrenPage() {
  return (
    <ProtectedRoute>
      <ObjectChildrenPageContent />
    </ProtectedRoute>
  )
}
