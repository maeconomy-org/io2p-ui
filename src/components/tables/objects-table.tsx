'use client'

import { MouseEvent, useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileText,
  Trash2,
  QrCode,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type {
  ColumnDef,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table'

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  CopyButton,
} from '@/components/ui'
import { cn, logger } from '@/lib'
import { useUnifiedDelete, useObjects, useGroups } from '@/hooks'
import { GroupBadge } from '@/components/ui/group-badge'
import { CopyObjectsSheet } from '@/components/object-sheets'
import { useObjectOperations } from '@/components/object-sheets/hooks/use-object-operations'
import {
  QRCodeModal,
  DeleteConfirmationDialog,
  TemplateCreationDialog,
} from '@/components/modals'
import { DataTable, getSelectColumn } from './data-table'
import { ObjectActionsCell } from './object-actions-cell'

interface ObjectsTableProps {
  initialData?: any[]
  fetching?: boolean
  onViewObject?: (object: any) => void
  onObjectDoubleClick?: (object: any) => void
  pagination?: {
    currentPage: number
    totalPages: number
    totalElements: number
    pageSize: number
    isFirstPage: boolean
    isLastPage: boolean
  }
  onPageChange?: (page: number) => void
  onFirstPage?: () => void
  onPreviousPage?: () => void
  onNextPage?: () => void
  onLastPage?: () => void
  onPageSizeChange?: (size: number) => void
  // Selection
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  enableRowSelection?: boolean
  // Column visibility
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
}

const isObjectDeleted = (object: any) => {
  if (!object || !object.softDeleted) return false
  return object.softDeleted === true
}

export function ObjectsTable({
  initialData,
  fetching = false,
  onViewObject,
  onObjectDoubleClick,
  pagination,
  onPageChange,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
  rowSelection = {},
  onRowSelectionChange,
  enableRowSelection = false,
  columnVisibility = {},
  onColumnVisibilityChange,
}: ObjectsTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<any[]>([])

  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false)
  const [selectedQRObject, setSelectedQRObject] = useState<any>(null)

  // Copy objects state
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<any>(null)

  // Template creation state
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [templateSource, setTemplateSource] = useState<any>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  // Template creation hook
  const { createObject: createTemplate } = useObjectOperations({
    isEditing: false,
    isTemplate: true,
  })

  // Unified delete hook
  const {
    isDeleteModalOpen,
    objectToDelete,
    isDeleting,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useUnifiedDelete()

  // Revert functionality
  const { useRevertObject } = useObjects()
  const revertObjectMutation = useRevertObject()

  // Fetch groups for group column display
  const { useListGroups } = useGroups()
  const { data: groups = [] } = useListGroups()
  const groupsMap = useMemo(() => {
    const map = new Map<string, any>()
    groups.forEach((group: any) => {
      if (group.groupUUID) {
        map.set(group.groupUUID, group)
      }
    })
    return map
  }, [groups])

  // Load data from props
  useEffect(() => {
    setData(initialData ?? [])
  }, [initialData])

  const handleViewDetails = (object: any) => {
    if (onViewObject && object?.uuid) {
      onViewObject(object)
    }
  }

  const handleShowQRCode = (object: any, e: MouseEvent) => {
    e.stopPropagation()
    setSelectedQRObject(object)
    setIsQRCodeModalOpen(true)
  }

  const navigateToChildren = (object: any) => {
    router.push(`/objects/${object.uuid}`)
  }

  const handleRowDoubleClick = (object: any) => {
    if (onObjectDoubleClick) {
      onObjectDoubleClick(object)
    } else {
      navigateToChildren(object)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleRevertObject = async (object: any) => {
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
  }

  // Get initial template data from the source object
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

  // Handle confirming template creation
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

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<any, unknown>[]>(() => {
    const cols: ColumnDef<any, unknown>[] = []

    // Checkbox column (only when selection enabled)
    if (enableRowSelection) {
      cols.push(getSelectColumn())
    }

    // Name column
    cols.push({
      accessorKey: 'name',
      header: () => t('objects.fields.name'),
      cell: ({ row }) => {
        const object = row.original
        const childCount =
          object.childCount || (object.children ? object.children.length : 0)
        const isDeleted = isObjectDeleted(object)

        return (
          <div className="flex items-center font-medium">
            <span
              className={cn(
                'truncate max-w-[200px]',
                isDeleted && 'line-through text-destructive'
              )}
            >
              {object.name}
            </span>
            {isDeleted && (
              <span className="ml-2 text-xs text-destructive">
                {t('objects.deletedBadge')}
              </span>
            )}
            {childCount > 0 && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {childCount}
                      <ChevronRight className="h-2.5 w-2.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t('objects.childrenTooltip', { count: childCount })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
    })

    // UUID column - truncated on mobile
    cols.push({
      accessorKey: 'uuid',
      header: () => t('objects.fields.uuid'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          {/* Full UUID on desktop, truncated on mobile */}
          <span className="hidden sm:inline">{row.original.uuid}</span>
          <span className="sm:hidden">{row.original.uuid.slice(0, 5)}...</span>
          <CopyButton
            text={row.original.uuid}
            label={t('objects.fields.uuid')}
          />
        </div>
      ),
    })

    // Group column
    cols.push({
      id: 'group',
      header: () => t('objects.fields.group'),
      cell: ({ row }) => {
        const groupUUID = row.original.groupUUID
        if (!groupUUID) return <span className="text-muted-foreground">—</span>

        const group = groupsMap.get(groupUUID)
        if (!group)
          return (
            <span className="text-muted-foreground text-xs font-mono">
              {groupUUID.slice(0, 8)}...
            </span>
          )
        const isPublic =
          group.publicShare && group.publicShare.permissions?.length > 0
        return (
          <GroupBadge
            groupName={group.name}
            groupType={isPublic ? 'public' : 'private'}
            size="sm"
          />
        )
      },
    })

    // Created column
    cols.push({
      accessorKey: 'createdAt',
      header: () => t('objects.fields.created'),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    })

    // Actions column — using ObjectActionsCell component
    cols.push({
      id: 'actions',
      header: () => (
        <span className="text-right block">{t('common.actions')}</span>
      ),
      enableHiding: false,
      cell: ({ row }) => {
        const object = row.original
        const isDeleted = isObjectDeleted(object)

        return (
          <ObjectActionsCell
            object={object}
            isDeleted={isDeleted}
            onViewDetails={handleViewDetails}
            onShowQRCode={handleShowQRCode}
            onDuplicate={(obj) => {
              setCopyTarget(obj)
              setIsCopySheetOpen(true)
            }}
            onCreateTemplate={(obj) => {
              setTemplateSource(obj)
              setIsTemplateDialogOpen(true)
            }}
            onDelete={(obj) => {
              handleDelete({
                uuid: obj.uuid,
                name: obj.name,
              })
            }}
            onRestore={handleRevertObject}
            isDeleting={isDeleting}
            isRestoring={revertObjectMutation.isPending}
          />
        )
      },
    })

    return cols
  }, [enableRowSelection, t, groupsMap])

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.uuid}
        enableRowSelection={enableRowSelection}
        rowSelection={rowSelection}
        onRowSelectionChange={
          onRowSelectionChange
            ? (updater) => {
                const next =
                  typeof updater === 'function'
                    ? updater(rowSelection)
                    : updater
                onRowSelectionChange(next)
              }
            : undefined
        }
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={
          onColumnVisibilityChange
            ? (updater) => {
                const next =
                  typeof updater === 'function'
                    ? updater(columnVisibility)
                    : updater
                onColumnVisibilityChange(next)
              }
            : undefined
        }
        pagination={pagination}
        onPageChange={onPageChange}
        onFirstPage={onFirstPage}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onLastPage={onLastPage}
        onPageSizeChange={onPageSizeChange}
        onRowDoubleClick={handleRowDoubleClick}
        rowClassName={(row) => cn(isObjectDeleted(row) && 'bg-destructive/10')}
        fetching={fetching}
        emptyIcon={<FileText className="h-10 w-10 text-muted-foreground/50" />}
        emptyTitle={t('objects.noObjectsTitle')}
        emptyDescription={t('objects.noObjectsDescription')}
      />

      {/* QR Code Modal */}
      {isQRCodeModalOpen && selectedQRObject && (
        <QRCodeModal
          isOpen={isQRCodeModalOpen}
          onClose={() => setIsQRCodeModalOpen(false)}
          uuid={selectedQRObject.uuid}
          objectName={selectedQRObject.name}
        />
      )}

      {/* Unified Delete Confirmation Dialog */}
      {isDeleteModalOpen && objectToDelete && (
        <DeleteConfirmationDialog
          open={isDeleteModalOpen}
          onOpenChange={handleDeleteCancel}
          objectName={objectToDelete.name}
          onDelete={handleDeleteConfirm}
        />
      )}

      {/* Copy Objects Sheet */}
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

      {/* Template Creation Dialog */}
      {isTemplateDialogOpen && templateSource && (
        <TemplateCreationDialog
          open={isTemplateDialogOpen}
          onOpenChange={setIsTemplateDialogOpen}
          initialData={getInitialTemplateData(templateSource)}
          onConfirm={handleConfirmTemplateCreation}
          isCreating={isCreatingTemplate}
        />
      )}
    </>
  )
}
