'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'

import {
  useViewData,
  useBreadcrumbTrail,
  useBulkSelection,
  useGroups,
} from '@/hooks'
import { useSearch, useAuth } from '@/contexts'
import { isObjectDeleted } from '@/lib'
import { canUserWriteRecords } from '@/lib/group-utils'
import ProtectedRoute from '@/components/protected-route'
import InitialLoginTour from '@/components/onboarding/initial-login-tour'
import { Button } from '@/components/ui'
import { DeletedFilter, GroupFilter } from '@/components/filters'
import { SearchResultsBar } from '@/components/search-results-bar'
import { ViewSelector, ViewType } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'
import { BulkActionsToolbar, DataTableColumnToggle } from '@/components/tables'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'

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
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [viewType, setViewType] = useState<ViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('view')
      if (saved === 'table' || saved === 'columns') return saved
    }
    return 'table'
  })
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
  const searchParams = useSearchParams()
  const { clearTrail } = useBreadcrumbTrail(undefined)
  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  // Handle groupId query param - preselect group from URL
  useEffect(() => {
    const groupId = searchParams.get('groupId')
    if (groupId && selectedGroupUUID !== groupId) {
      setSelectedGroupUUID(groupId)
    }
  }, [searchParams, selectedGroupUUID])

  // Clear groupId from URL when group filter changes
  const handleGroupChange = useCallback(
    (groupUUID: string | null) => {
      setSelectedGroupUUID(groupUUID)
      // Clear groupId from URL if it exists
      const groupId = searchParams.get('groupId')
      if (groupId) {
        router.replace('/objects', { scroll: false })
      }
    },
    [searchParams, router]
  )

  // Determine if user has write permissions for the selected group(s)
  const { useListGroups } = useGroups()
  const { data: allGroups } = useListGroups()
  const { userUUID } = useAuth()

  const groupReadOnly = useMemo(() => {
    if (!selectedGroupUUID || !allGroups) return false
    const group = allGroups.find((g: any) => g.groupUUID === selectedGroupUUID)
    if (!group) return false
    return !canUserWriteRecords(group, userUUID)
  }, [selectedGroupUUID, allGroups, userUUID])

  // Use the data adapter hook - handles all data fetching internally
  const viewData = useViewData({
    viewType,
    showDeleted,
    tablePageSize: pageSize,
    groupUUIDList: selectedGroupUUID ? [selectedGroupUUID] : undefined,
  })

  // Bulk selection hook - consolidates all bulk selection logic
  const tableData = viewData.type === 'table' ? viewData.data : []
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
    data: tableData,
    rowSelection,
    setRowSelection,
  })

  // Clear selection on view type change or search mode change
  useEffect(() => {
    setRowSelection({})
  }, [viewType, isSearchMode])

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
              onGroupChange={handleGroupChange}
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

        {/* Bulk Actions Toolbar — sits between header and table (hidden when group is read-only) */}
        {viewType === 'table' && selectedCount > 0 && !groupReadOnly && (
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

        {/* Search Mode Indicator */}
        {isSearchMode && (
          <SearchResultsBar
            searchQuery={searchQuery}
            resultsCount={searchViewResults.length}
            pagination={searchPagination ?? undefined}
            onClearSearch={clearSearch}
          />
        )}

        {viewData.loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <ObjectViewContainer
            viewType={viewType}
            viewData={viewData}
            onViewObject={handleViewObject}
            onObjectDoubleClick={handleObjectDoubleClick}
            onDuplicate={
              groupReadOnly
                ? undefined
                : (object) => {
                    setCopyTarget(object)
                    setIsCopySheetOpen(true)
                  }
            }
            showDeleted={showDeleted}
            enableRowSelection={viewType === 'table' && !groupReadOnly}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onPageSizeChange={setPageSize}
            readOnly={groupReadOnly}
          />
        )}
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
