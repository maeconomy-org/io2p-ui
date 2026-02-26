'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RowSelectionState, VisibilityState } from '@tanstack/react-table'

import dynamic from 'next/dynamic'
import { useViewData, useBreadcrumbTrail, useBulkActions } from '@/hooks'
import { useSearch } from '@/contexts'
import { isObjectDeleted } from '@/lib'
import ProtectedRoute from '@/components/protected-route'
import InitialLoginTour from '@/components/onboarding/initial-login-tour'
import { Button, Badge, DeletedFilter, GroupFilter } from '@/components/ui'
import { ViewSelector, ViewType } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'
import { BulkActionsToolbar, DataTableColumnToggle } from '@/components/tables'

// Lazy-load sheet components — only rendered when opened by user interaction
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

function ObjectsPageContent() {
  const t = useTranslations()
  const [pageSize, setPageSize] = useState(20)
  const [viewType, setViewType] = useState<ViewType>('table')
  const [showDeleted, setShowDeleted] = useState<boolean>(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedGroupUUID, setSelectedGroupUUID] = useState<string | null>(
    null
  )

  // Row selection state (keyed by object UUID)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  // Copy objects state (for columns view — table handles its own)
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<any>(null)

  const router = useRouter()
  const { clearTrail } = useBreadcrumbTrail(undefined)
  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  // Use the data adapter hook - handles all data fetching internally
  const viewData = useViewData({
    viewType,
    showDeleted,
    tablePageSize: pageSize,
    groupUUIDList: selectedGroupUUID ? [selectedGroupUUID] : undefined,
  })

  // Bulk actions
  const {
    bulkDeleteMutation,
    bulkRevertMutation,
    bulkAddToGroupMutation,
    bulkCreateAndAddToGroupMutation,
    bulkSetParentMutation,
  } = useBulkActions()

  // Derive selected objects from current data
  const selectedObjects = useMemo(() => {
    if (viewData.type !== 'table') return []
    const data = viewData.data ?? []
    return data.filter((obj: any) => rowSelection[obj.uuid])
  }, [viewData, rowSelection])

  const selectedCount = Object.keys(rowSelection).length
  const allSelectedDeleted =
    selectedObjects.length > 0 &&
    selectedObjects.every((obj: any) => isObjectDeleted(obj))
  const hasNonDeletedSelected = selectedObjects.some(
    (obj: any) => !isObjectDeleted(obj)
  )

  // Clear selection on view type change or search mode change
  useEffect(() => {
    setRowSelection({})
  }, [viewType, isSearchMode])

  // Clear selection after successful bulk operations
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const handleBulkDelete = useCallback(() => {
    const nonDeleted = selectedObjects.filter(
      (obj: any) => !isObjectDeleted(obj)
    )
    if (nonDeleted.length === 0) return
    bulkDeleteMutation.mutate(nonDeleted, { onSuccess: clearSelection })
  }, [selectedObjects, bulkDeleteMutation, clearSelection])

  const handleBulkRestore = useCallback(() => {
    const deleted = selectedObjects.filter((obj: any) => isObjectDeleted(obj))
    if (deleted.length === 0) return
    bulkRevertMutation.mutate(deleted, { onSuccess: clearSelection })
  }, [selectedObjects, bulkRevertMutation, clearSelection])

  const handleAddToGroup = useCallback(
    (groupUUID: string) => {
      const uuids = selectedObjects.map((obj: any) => obj.uuid)
      if (uuids.length === 0) return
      bulkAddToGroupMutation.mutate(
        { groupUUID, objectUUIDs: uuids },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkAddToGroupMutation, clearSelection]
  )

  const handleCreateAndAddToGroup = useCallback(
    (name: string) => {
      const uuids = selectedObjects.map((obj: any) => obj.uuid)
      if (uuids.length === 0) return
      bulkCreateAndAddToGroupMutation.mutate(
        { groupName: name, objectUUIDs: uuids },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkCreateAndAddToGroupMutation, clearSelection]
  )

  const handleSetParent = useCallback(
    (parentUUID: string) => {
      const childUUIDs = selectedObjects.map((obj: any) => obj.uuid)
      if (childUUIDs.length === 0) return
      bulkSetParentMutation.mutate(
        { parentUUID, childUUIDs },
        { onSuccess: clearSelection }
      )
    },
    [selectedObjects, bulkSetParentMutation, clearSelection]
  )

  // Initialize view type from localStorage after the component mounts
  useEffect(() => {
    const savedView = localStorage.getItem('view')
    if (savedView && (savedView === 'table' || savedView === 'columns')) {
      setViewType(savedView as ViewType)
    } else {
      // Default to table if saved view is invalid or explorer
      setViewType('table')
      localStorage.setItem('view', 'table')
    }
  }, [])

  const handleAddObject = () => {
    setSelectedObject(null)
    setIsObjectEditSheetOpen(true)
  }

  const handleViewObject = (object: any) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }

  // Handle double-click to navigate to children page
  const handleObjectDoubleClick = useCallback(
    (object: any) => {
      // Clear the trail — navigating from root means no ancestors
      clearTrail()
      router.push(`/objects/${object.uuid}`)
    },
    [clearTrail, router]
  )

  return (
    <div className="container mx-auto p-4">
      <InitialLoginTour />
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h1 className="text-2xl font-bold shrink-0">{t('objects.title')}</h1>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
            <DeletedFilter
              showDeleted={showDeleted}
              onShowDeletedChange={setShowDeleted}
              label={t('objects.showDeleted')}
              data-tour="filters"
            />
            <GroupFilter
              selectedGroupUUID={selectedGroupUUID}
              onGroupChange={setSelectedGroupUUID}
            />
            <ViewSelector
              view={viewType}
              onChange={(value: ViewType) => {
                setViewType(value)
                localStorage.setItem('view', value)
              }}
              data-tour="view-selector"
            />
            <Button
              size="sm"
              onClick={handleAddObject}
              data-tour="create-object"
            >
              <PlusCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('objects.create')}</span>
            </Button>
          </div>
        </div>

        {/* Bulk Actions Toolbar — sits between header and table */}
        {viewType === 'table' && selectedCount > 0 && (
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
            isDeleting={bulkDeleteMutation.isPending}
            isRestoring={bulkRevertMutation.isPending}
            isAddingToGroup={
              bulkAddToGroupMutation.isPending ||
              bulkCreateAndAddToGroupMutation.isPending
            }
            isSettingParent={bulkSetParentMutation.isPending}
          />
        )}

        {/* Search Mode Indicator */}
        {isSearchMode && (
          <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {t('objects.searchResults', { query: searchQuery })}
                  </span>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {searchPagination
                    ? t('objects.resultsPage', {
                        count: searchPagination.totalElements,
                        page: searchPagination.currentPage + 1,
                        pages: searchPagination.totalPages,
                      })
                    : t('objects.results', {
                        count: searchViewResults.length,
                      })}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4 mr-1" />
                {t('objects.clearSearch')}
              </Button>
            </div>
          </div>
        )}

        <ObjectViewContainer
          viewType={viewType}
          viewData={viewData}
          onViewObject={handleViewObject}
          onObjectDoubleClick={handleObjectDoubleClick}
          onDuplicate={(object) => {
            setCopyTarget(object)
            setIsCopySheetOpen(true)
          }}
          showDeleted={showDeleted}
          enableRowSelection={viewType === 'table'}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Object detail sheet */}
      <ObjectDetailsSheet
        isOpen={isObjectSheetOpen}
        onClose={() => setIsObjectSheetOpen(false)}
        object={selectedObject}
        uuid={selectedObject?.uuid}
        isDeleted={isObjectDeleted(selectedObject)}
      />

      {/* Object add sheet */}
      <ObjectAddSheet
        isOpen={isObjectEditSheetOpen}
        onClose={() => {
          setIsObjectEditSheetOpen(false)
          setSelectedObject(null)
        }}
      />

      {/* Copy Objects Sheet (columns view) */}
      {isCopySheetOpen && copyTarget && (
        <CopyObjectsSheet
          open={isCopySheetOpen}
          onOpenChange={setIsCopySheetOpen}
          preselectedObjects={[
            {
              uuid: copyTarget.uuid,
              name: copyTarget.name,
              hasChildren:
                copyTarget.hasChildren ||
                (copyTarget.children && copyTarget.children.length > 0),
              childCount:
                copyTarget.childCount || copyTarget.children?.length || 0,
            },
          ]}
        />
      )}
    </div>
  )
}

// Export the wrapped component
export default function ObjectsPage() {
  return (
    <ProtectedRoute>
      <ObjectsPageContent />
    </ProtectedRoute>
  )
}
