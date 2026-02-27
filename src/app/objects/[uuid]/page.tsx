'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { PlusCircle, Copy, FolderOpen } from 'lucide-react'
import type { RowSelectionState, VisibilityState } from '@tanstack/react-table'

import {
  useAggregate,
  useBreadcrumbTrail,
  useBulkSelection,
  useViewData,
} from '@/hooks'
import { Button } from '@/components/ui'
import { DeletedFilter } from '@/components/filters'
import { ObjectBreadcrumb } from '@/components/object-breadcrumb'
import { isObjectDeleted } from '@/lib'
import {
  ObjectsTable,
  BulkActionsToolbar,
  DataTableColumnToggle,
} from '@/components/tables'
import ProtectedRoute from '@/components/protected-route'
import { ContentSkeleton } from '@/components/skeletons'
import {
  ObjectDetailsSheet,
  ObjectAddSheet,
  CopyObjectsSheet,
} from '@/components/object-sheets'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

const TOGGLEABLE_COLUMNS = [
  { id: 'name', labelKey: 'objects.fields.name' },
  { id: 'uuid', labelKey: 'objects.fields.uuid' },
  { id: 'createdAt', labelKey: 'objects.fields.created' },
]

function ObjectChildrenPageContent() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  // Filter state
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

  // Row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // Hooks
  const { useAggregateByUUID } = useAggregate()
  const { ancestors, pushAncestor, navigateToAncestor, clearTrail } =
    useBreadcrumbTrail(parentUuid)

  // Get parent object details
  const { data: parentData, isLoading: parentLoading } = useAggregateByUUID(
    parentUuid,
    {
      enabled: !!parentUuid,
    }
  )

  // Get children with pagination using useViewData
  const viewData = useViewData({
    viewType: 'table',
    tablePageSize: DEFAULT_TABLE_PAGE_SIZE,
    showDeleted,
    parentUUID: parentUuid,
  })

  // Extract data from viewData (always table type for child pages)
  const childrenData = viewData.type === 'table' ? viewData.data : []
  const childrenLoading = viewData.loading
  const childrenFetching = viewData.type === 'table' ? viewData.fetching : false
  const pagination = viewData.type === 'table' ? viewData.pagination : null

  // Process parent object data
  const parentObject = useMemo(() => {
    if (parentData) {
      return parentData
    }
    return null
  }, [parentData])

  // Bulk selection hook - consolidates all bulk selection logic
  const {
    selectedCount,
    allSelectedDeleted,
    hasNonDeletedSelected,
    clearSelection,
    handlers: {
      handleBulkDelete,
      handleBulkRestore,
      handleAddToGroup,
      handleCreateAndAddToGroup,
      handleSetParent,
    },
    mutations: { isDeleting, isRestoring, isAddingToGroup, isSettingParent },
  } = useBulkSelection({
    data: childrenData,
    rowSelection,
    setRowSelection,
  })

  // State
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)

  // Copy objects state
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)

  // Pagination info from useViewData
  const totalPages = pagination?.totalPages || 0
  const totalElements = pagination?.totalElements || 0

  const handleViewObject = (object: any) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }

  // Handle double-click to navigate to sub-children
  const handleObjectDoubleClick = useCallback(
    (object: any) => {
      // Push the current parent onto the breadcrumb trail before navigating
      if (parentObject) {
        pushAncestor({
          uuid: parentUuid,
          name: (parentObject.name || parentUuid) as string,
        })
      }
      router.push(`/objects/${object.uuid}`)
    },
    [parentObject, parentUuid, pushAncestor, router]
  )

  const handleAddChild = () => {
    setSelectedObject(null)
    setIsObjectEditSheetOpen(true)
  }

  if (parentLoading) {
    return <ContentSkeleton />
  }

  if (!parentObject) {
    return (
      <div className="flex flex-col flex-1">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-40">
            <p>{t('objects.childrenPage.parentNotFound')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-4">
        {/* Breadcrumbs */}
        <ObjectBreadcrumb
          currentObject={{
            uuid: parentUuid,
            name: parentObject.name || parentUuid,
          }}
          ancestors={ancestors}
          onNavigateToAncestor={navigateToAncestor}
          onNavigateToRoot={clearTrail}
        />

        {/* Header with parent info */}
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
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {parentObject.uuid}
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
              onClick={() => setIsCopySheetOpen(true)}
              data-testid="page-header-copy-button"
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('objects.duplicate.copyHere')}
            </Button>
            <Button onClick={handleAddChild} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('objects.childrenPage.addChild')}
            </Button>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedCount > 0 && (
          <BulkActionsToolbar
            selectedCount={selectedCount}
            allSelectedDeleted={allSelectedDeleted}
            hasNonDeletedSelected={hasNonDeletedSelected}
            onBulkDelete={handleBulkDelete}
            onBulkRestore={handleBulkRestore}
            onAddToGroup={handleAddToGroup}
            onCreateAndAddToGroup={handleCreateAndAddToGroup}
            onSetParent={handleSetParent}
            onClearSelection={clearSelection}
            isDeleting={isDeleting}
            isRestoring={isRestoring}
            isAddingToGroup={isAddingToGroup}
            isSettingParent={isSettingParent}
          />
        )}

        {/* Children Table or Empty State */}
        {!childrenLoading && childrenData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t('objects.childrenPage.noChildrenTitle')}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              {t('objects.childrenPage.noChildrenDescription')}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCopySheetOpen(true)}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('objects.duplicate.copyHere')}
              </Button>
              <Button onClick={handleAddChild}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('objects.childrenPage.addChild')}
              </Button>
            </div>
          </div>
        ) : (
          <ObjectsTable
            initialData={childrenData}
            onViewObject={handleViewObject}
            onObjectDoubleClick={handleObjectDoubleClick}
            fetching={childrenFetching}
            pagination={{
              currentPage: (pagination?.currentPage || 0) + 1,
              totalPages,
              totalElements,
              pageSize: pagination?.pageSize || DEFAULT_TABLE_PAGE_SIZE,
              isFirstPage: pagination?.isFirstPage ?? true,
              isLastPage: pagination?.isLastPage ?? true,
            }}
            onPageChange={(page) => pagination?.handlePageChange(page)}
            onFirstPage={() => pagination?.handleFirst()}
            onPreviousPage={() => pagination?.handlePrevious()}
            onNextPage={() => pagination?.handleNext()}
            onLastPage={() => pagination?.handleLast()}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
        )}
      </div>

      {/* Child Object Details Sheet */}
      <ObjectDetailsSheet
        isOpen={isObjectSheetOpen}
        onClose={() => setIsObjectSheetOpen(false)}
        object={selectedObject}
        uuid={selectedObject?.uuid}
        isDeleted={isObjectDeleted(selectedObject)}
      />

      {/* Add Child Object Sheet */}
      <ObjectAddSheet
        isOpen={isObjectEditSheetOpen}
        onClose={() => {
          setIsObjectEditSheetOpen(false)
          setSelectedObject(null)
        }}
        defaultParentUuids={[parentUuid]}
      />

      {/* Copy Objects Sheet */}
      {isCopySheetOpen && (
        <CopyObjectsSheet
          open={isCopySheetOpen}
          onOpenChange={setIsCopySheetOpen}
          defaultParentUuid={parentUuid}
        />
      )}
    </div>
  )
}

// Export the wrapped component
export default function ObjectChildrenPage() {
  return (
    <ProtectedRoute>
      <ObjectChildrenPageContent />
    </ProtectedRoute>
  )
}
