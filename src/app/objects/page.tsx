'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle } from 'lucide-react'
import type { RowSelectionState } from '@tanstack/react-table'
import type { AggregateEntity } from 'iom-sdk'
import type { GroupCreateDTO } from 'iom-sdk'

import {
  useViewData,
  useBreadcrumbTrail,
  useBulkSelection,
  useGroups,
  useObjects,
  usePreference,
} from '@/hooks'
import { useSearch, useAuth } from '@/contexts'
import { isObjectDeleted, logger } from '@/lib'
import { canUserWriteRecords } from '@/components/groups'
import ProtectedRoute from '@/components/protected-route'
import InitialLoginTour from '@/components/onboarding/initial-login-tour'
import { Button } from '@/components/ui'
import { DeletedFilter, GroupFilter } from '@/components/filters'
import { SearchResultsBar } from '@/components/search-results-bar'
import { ViewSelector } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'
import { BulkActionsToolbar, DataTableColumnToggle } from '@/components/tables'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants'
import { useObjectDrafts } from '@/components/object-sheets/hooks'
import { useObjectOperations } from '@/components/object-sheets/hooks/use-object-operations'

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

function ObjectsPageContent() {
  const t = useTranslations()
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE)
  const [viewType, setViewType] = usePreference('objectsView')
  const [showDeleted, setShowDeleted] = useState<boolean>(false)
  const [selectedObject, setSelectedObject] = useState<AggregateEntity | null>(
    null
  )
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedGroupUUID, setSelectedGroupUUID] = useState<string | null>(
    null
  )

  // Row selection state (keyed by object UUID)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  // Copy objects state (for columns view — table handles its own)
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<AggregateEntity | null>(null)

  // QR / Passport / Template state hoisted from the table so both views share
  // a single modal instance — see the View Details pattern (handleViewObject).
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false)
  const [selectedQRObject, setSelectedQRObject] = useState<any>(null)
  const [isPassportSheetOpen, setIsPassportSheetOpen] = useState(false)
  const [passportTarget, setPassportTarget] = useState<any>(null)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [templateSource, setTemplateSource] = useState<any>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  const { createObject: createTemplate } = useObjectOperations({
    isEditing: false,
    isTemplate: true,
  })

  const { useRevertObject } = useObjects()
  const revertObjectMutation = useRevertObject()

  // Draft state — UI-only, surfaced as pinned rows on page 1 when no filters
  const { drafts, deleteDraft } = useObjectDrafts()
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [hideDrafts, setHideDrafts] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('iom-objects:hide-drafts') === '1'
  })
  const handleHideDraftsChange = useCallback((next: boolean) => {
    setHideDrafts(next)
    try {
      localStorage.setItem('iom-objects:hide-drafts', next ? '1' : '0')
    } catch {
      // silent fail
    }
  }, [])

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
  const { useAllGroups } = useGroups()
  const { data: allGroups } = useAllGroups()
  const { userUUID } = useAuth()

  const groupReadOnly = useMemo(() => {
    if (!selectedGroupUUID || !allGroups) return false
    const group = allGroups.find(
      (g: GroupCreateDTO) => g.groupUUID === selectedGroupUUID
    )
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
    setEditingDraftId(null)
    setIsObjectEditSheetOpen(true)
  }

  const handleOpenDraft = useCallback((id: string) => {
    setSelectedObject(null)
    setEditingDraftId(id)
    setIsObjectEditSheetOpen(true)
  }, [])

  // Drafts pin only when nothing is filtering the live data — otherwise the
  // visual hierarchy ("here are real matches") would be muddied. Applies to
  // both views: table pins on page 1 of the data, columns view pins on page 1
  // of the root column. NOTE pagination indexing differs across views —
  // table.currentPage is 0-based, columns.rootPagination.currentPage is
  // 1-based (see use-view-data.ts).
  const draftRows = useMemo(() => {
    if (hideDrafts) return undefined
    if (isSearchMode) return undefined
    if (selectedGroupUUID) return undefined
    if (viewData.type === 'table' && viewData.pagination.currentPage !== 0) {
      return undefined
    }
    if (
      viewData.type === 'columns' &&
      viewData.rootPagination &&
      viewData.rootPagination.currentPage > 1
    ) {
      return undefined
    }
    return drafts.map((d) => ({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
    }))
  }, [drafts, hideDrafts, isSearchMode, selectedGroupUUID, viewData])

  const handleViewObject = (object: AggregateEntity) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }

  const handleShowQRCode = useCallback((object: any) => {
    setSelectedQRObject(object)
    setIsQRCodeModalOpen(true)
  }, [])

  const handleViewPassport = useCallback((object: any) => {
    setPassportTarget(object)
    setIsPassportSheetOpen(true)
  }, [])

  const handleCreateTemplate = useCallback((object: any) => {
    setTemplateSource(object)
    setIsTemplateDialogOpen(true)
  }, [])

  const handleRestoreObject = useCallback(
    async (object: any) => {
      try {
        await revertObjectMutation.mutateAsync({
          uuid: object.uuid,
          name: object.name,
          abbreviation: object.abbreviation,
          version: object.version,
          description: object.description,
        })
      } catch (error) {
        logger.error('Error reverting object:', error)
      }
    },
    [revertObjectMutation]
  )

  const getInitialTemplateData = (sourceObj: any) => {
    if (!sourceObj)
      return { name: '', abbreviation: '', version: '1.0', description: '' }
    return {
      name: `${sourceObj.name} Template`,
      abbreviation: sourceObj.abbreviation || '',
      version: '1.0',
      description: `Template created from ${sourceObj.name}`,
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
      const fullTemplateData = {
        name: templateData.name,
        abbreviation: templateData.abbreviation,
        version: templateData.version,
        description: templateData.description,
        properties:
          templateSource.properties?.map((prop: any) => ({
            key: prop.key,
            label: prop.label || prop.key,
            type: prop.type || 'string',
            values: prop.values?.map((val: any) => ({
              value: 'Variable',
              valueTypeCast: val.valueTypeCast || 'string',
              files: [],
            })) || [
              {
                value: 'Variable',
                valueTypeCast: 'string',
                sourceType: 'manual',
                files: [],
              },
            ],
            files: [],
          })) || [],
        files: [],
        parents: [],
      }
      await createTemplate(fullTemplateData)
      setIsTemplateDialogOpen(false)
      setTemplateSource(null)
    } catch (error) {
      logger.error('Error creating template:', error)
    } finally {
      setIsCreatingTemplate(false)
    }
  }

  // Handle double-click to navigate to children page
  const handleObjectDoubleClick = useCallback(
    (object: AggregateEntity) => {
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
              hideDrafts={hideDrafts}
              onHideDraftsChange={handleHideDraftsChange}
              label={t('objects.showDeleted')}
              data-tour="filters"
            />
            <GroupFilter
              selectedGroupUUID={selectedGroupUUID}
              onGroupChange={handleGroupChange}
            />
            <ViewSelector
              view={viewType}
              onChange={setViewType}
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
            draftRows={draftRows}
            onOpenDraft={handleOpenDraft}
            onDiscardDraft={deleteDraft}
            onShowQRCode={handleShowQRCode}
            onViewPassport={handleViewPassport}
            onCreateTemplate={handleCreateTemplate}
            onRestore={handleRestoreObject}
            isRestoring={revertObjectMutation.isPending}
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
        draftId={editingDraftId}
        onClose={() => {
          setIsObjectEditSheetOpen(false)
          setSelectedObject(null)
          setEditingDraftId(null)
        }}
      />

      {/* QR Code modal (lazy) — single instance for both views */}
      {isQRCodeModalOpen && selectedQRObject && (
        <QRCodeModal
          isOpen={isQRCodeModalOpen}
          onClose={() => setIsQRCodeModalOpen(false)}
          uuid={selectedQRObject.uuid}
          objectName={selectedQRObject.name}
        />
      )}

      {/* Product Passport sheet (lazy) — single instance for both views */}
      {isPassportSheetOpen && passportTarget && (
        <ProductPassportSheet
          isOpen={isPassportSheetOpen}
          onClose={() => setIsPassportSheetOpen(false)}
          uuid={passportTarget.uuid}
          object={passportTarget}
        />
      )}

      {/* Template creation dialog (lazy) — single instance for both views */}
      {isTemplateDialogOpen && templateSource && (
        <TemplateCreationDialog
          open={isTemplateDialogOpen}
          onOpenChange={setIsTemplateDialogOpen}
          initialData={getInitialTemplateData(templateSource)}
          onConfirm={handleConfirmTemplateCreation}
          isCreating={isCreatingTemplate}
        />
      )}

      {/* Copy Objects Sheet (columns view) */}
      {isCopySheetOpen && copyTarget && (
        <CopyObjectsSheet
          open={isCopySheetOpen}
          onOpenChange={setIsCopySheetOpen}
          preselectedObjects={[
            {
              uuid: copyTarget.uuid ?? '',
              name: copyTarget.name ?? '',
              hasChildren:
                (copyTarget.children && copyTarget.children.length > 0) ??
                false,
              childCount: copyTarget.children?.length ?? 0,
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
