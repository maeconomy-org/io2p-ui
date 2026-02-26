'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { PlusCircle, Copy, FolderOpen, HomeIcon } from 'lucide-react'
import Link from 'next/link'
import type { RowSelectionState, VisibilityState } from '@tanstack/react-table'

import { useAggregate, useBreadcrumbTrail, useBulkActions } from '@/hooks'
import {
  Button,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
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

const TOGGLEABLE_COLUMNS = [
  { id: 'name', labelKey: 'objects.fields.name' },
  { id: 'uuid', labelKey: 'objects.fields.uuid' },
  { id: 'createdAt', labelKey: 'objects.fields.created' },
]

// Truncate text with ellipsis and show full text on hover using Radix tooltip
function TruncateWithTooltip({
  text,
  maxLength,
}: {
  text: string
  maxLength: number
}) {
  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate ? text.slice(0, maxLength) + '...' : text

  if (!shouldTruncate) {
    return <>{displayText}</>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{displayText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ObjectChildrenPageContent() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  // Pagination state for children
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(15)

  // Row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // Hooks
  const { useAggregateByUUID, useAggregateEntities } = useAggregate()
  const { ancestors, pushAncestor, navigateToAncestor, clearTrail } =
    useBreadcrumbTrail(parentUuid)

  // Get parent object details
  const { data: parentData, isLoading: parentLoading } = useAggregateByUUID(
    parentUuid,
    {
      enabled: !!parentUuid,
    }
  )

  // Get children with pagination
  const { data: childrenResponse, isLoading: childrenLoading } =
    useAggregateEntities(
      {
        parentUUID: parentUuid,
        hasParentUUIDFilter: true,
        page: currentPage,
        size: pageSize,
      },
      {
        enabled: !!parentUuid,
        staleTime: 30000,
        keepPreviousData: true,
      }
    )

  // Process parent object data
  const parentObject = useMemo(() => {
    if (parentData) {
      return parentData
    }
    return null
  }, [parentData])

  // Process children data and enhance with child info
  const childrenData = useMemo(() => {
    const allChildren = childrenResponse?.content || []

    return allChildren.map((obj) => ({
      ...obj,
      hasChildren: obj.children && obj.children.length > 0,
      childCount: obj.children ? obj.children.length : 0,
    }))
  }, [childrenResponse])

  // Bulk actions
  const {
    bulkDeleteMutation,
    bulkRevertMutation,
    bulkAddToGroupMutation,
    bulkCreateAndAddToGroupMutation,
    bulkSetParentMutation,
  } = useBulkActions()

  // Derive selected objects from children data
  const selectedObjects = useMemo(() => {
    return childrenData.filter(
      (obj) => obj.uuid && rowSelection[obj.uuid]
    ) as any[]
  }, [childrenData, rowSelection])

  const selectedCount = Object.keys(rowSelection).length
  const allSelectedDeleted =
    selectedObjects.length > 0 &&
    selectedObjects.every((obj: any) => isObjectDeleted(obj))
  const hasNonDeletedSelected = selectedObjects.some(
    (obj: any) => !isObjectDeleted(obj)
  )

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

  // State
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)

  // Copy objects state
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)

  // Pagination info
  const totalPages = childrenResponse?.totalPages || 0
  const totalElements = childrenResponse?.totalElements || 0
  const isFirstPage = childrenResponse?.first ?? true
  const isLastPage = childrenResponse?.last ?? true

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

  // Truncate breadcrumb: show first 3 + ... + last 3 when > 6 ancestors
  const MAX_VISIBLE = 4
  const EDGE_COUNT = 2

  const truncatedAncestors = useMemo(() => {
    if (ancestors.length <= MAX_VISIBLE) {
      return { leading: ancestors, trailing: [], truncated: false }
    }
    return {
      leading: ancestors.slice(0, EDGE_COUNT),
      trailing: ancestors.slice(-1),
      truncated: true,
    }
  }, [ancestors])

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
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/objects"
                  className="flex items-center gap-2"
                  onClick={() => clearTrail()}
                >
                  <HomeIcon className="size-4" />
                  {t('objects.childrenPage.breadcrumbRoot')}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {truncatedAncestors.leading.map((ancestor) => (
              <span key={ancestor.uuid} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/objects/${ancestor.uuid}`}
                      onClick={() => navigateToAncestor(ancestor.uuid)}
                    >
                      <TruncateWithTooltip
                        text={ancestor.name}
                        maxLength={25}
                      />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </span>
            ))}
            {truncatedAncestors.truncated && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                {truncatedAncestors.trailing.map((ancestor) => (
                  <span key={ancestor.uuid} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          href={`/objects/${ancestor.uuid}`}
                          onClick={() => navigateToAncestor(ancestor.uuid)}
                        >
                          <TruncateWithTooltip
                            text={ancestor.name}
                            maxLength={25}
                          />
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </span>
                ))}
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                <TruncateWithTooltip
                  text={parentObject.name || parentUuid}
                  maxLength={25}
                />
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

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
            isDeleting={bulkDeleteMutation.isPending}
            isRestoring={bulkRevertMutation.isPending}
            isAddingToGroup={
              bulkAddToGroupMutation.isPending ||
              bulkCreateAndAddToGroupMutation.isPending
            }
            isSettingParent={bulkSetParentMutation.isPending}
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
            fetching={childrenLoading}
            pagination={{
              currentPage: currentPage + 1,
              totalPages,
              totalElements,
              pageSize,
              isFirstPage,
              isLastPage,
            }}
            onPageChange={(page) => setCurrentPage(page)}
            onFirstPage={() => setCurrentPage(0)}
            onPreviousPage={() =>
              setCurrentPage((prev) => Math.max(0, prev - 1))
            }
            onNextPage={() =>
              setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
            }
            onLastPage={() => setCurrentPage(() => totalPages - 1)}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(0)
            }}
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
