'use client'

import { MouseEvent, useState, useEffect } from 'react'
import { FileText, Trash2, QrCode, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  CopyButton,
  TablePagination,
} from '@/components/ui'
import { cn, logger } from '@/lib'
import { useUnifiedDelete, useObjects } from '@/hooks'
import { QRCodeModal, DeleteConfirmationDialog } from '@/components/modals'

interface ObjectsTableProps {
  initialData?: any[]
  fetching?: boolean // Loading state for pagination/refresh
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
}: ObjectsTableProps) {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false)
  const [selectedQRObject, setSelectedQRObject] = useState<any>(null)

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

  // Load data from props
  useEffect(() => {
    if (initialData) {
      setData(initialData)
    } else {
      setData([])
    }
    setIsLoading(false)
  }, [initialData])

  const handleViewDetails = (object: any) => {
    if (onViewObject) {
      if (object && object.uuid) {
        onViewObject(object)
      }
    }
  }

  const handleShowQRCode = (object: any, e: MouseEvent) => {
    e.stopPropagation()
    setSelectedQRObject(object)
    setIsQRCodeModalOpen(true)
  }

  const navigateToChildren = (object: any) => {
    if (object.children && object.children.length > 0) {
      router.push(`/objects/${object.uuid}`)
    }
  }

  const handleRowDoubleClick = (object: any) => {
    if (onObjectDoubleClick) {
      onObjectDoubleClick(object)
    } else if (
      object.hasChildren ||
      (object.children && object.children.length > 0)
    ) {
      // Fallback behavior
      navigateToChildren(object)
    } else {
      handleViewDetails(object)
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

  const renderRows = (objects: any[], level = 0) => {
    return objects.flatMap((object) => {
      const hasChildren =
        object.hasChildren || (object.children && object.children.length > 0)
      const childCount =
        object.childCount || (object.children ? object.children.length : 0)
      const isDeleted = isObjectDeleted(object)

      const rows = [
        <TableRow
          key={object.uuid}
          onDoubleClick={() => handleRowDoubleClick(object)}
          className={cn(
            'cursor-pointer hover:bg-muted/50',
            isDeleted ? 'bg-destructive/10' : ''
          )}
        >
          <TableCell className="font-medium">
            <div className="flex items-center">
              <div style={{ width: `${level * 16}px` }} />
              <span
                className={`truncate max-w-[200px] ${
                  isDeleted ? 'line-through text-destructive' : ''
                }`}
              >
                {object.name}
              </span>
              {isDeleted && (
                <span className="ml-2 text-xs text-destructive">(Deleted)</span>
              )}
            </div>
          </TableCell>
          <TableCell className="font-mono text-xs text-muted-foreground truncate">
            <div className="flex items-center gap-2">
              <span className="truncate flex">{object.uuid}</span>
              <CopyButton text={object.uuid} label="UUID" />
            </div>
          </TableCell>
          <TableCell>
            {hasChildren && (
              <div className="flex items-center gap-1">
                <span className="text-sm">{childCount}</span>
                {hasChildren && (
                  <span className="text-xs text-muted-foreground">
                    (double-click)
                  </span>
                )}
              </div>
            )}
          </TableCell>
          <TableCell>{formatDate(object.createdAt)}</TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleShowQRCode(object, e)}
              title="Show QR Code"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewDetails(object)
                }}
              >
                <FileText className="h-4 w-4" />
              </Button>

              {isDeleted ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRevertObject(object)
                  }}
                  disabled={revertObjectMutation.isPending}
                  title="Restore object"
                >
                  <RotateCcw className="h-4 w-4 text-blue-600" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete({
                      uuid: object.uuid,
                      name: object.name,
                    })
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>,
      ]

      return rows
    })
  }

  // Only show full loading screen on initial load when there's no data
  if (isLoading && data.length === 0) {
    return (
      <div className="flex justify-center items-center h-40">Loading...</div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>UUID</TableHead>
              <TableHead>Children</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fetching ? (
              <TableRow>
                <TableCell className="text-center py-4" {...{ colSpan: 6 }}>
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2"></div>
                    Updating data...
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-8" {...{ colSpan: 6 }}>
                  <div className="flex flex-col items-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No Objects Found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      There are no objects to display
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderRows(data)
            )}
          </TableBody>
        </Table>
      </div>

      {/* Table Pagination */}
      {pagination && (
        <TablePagination
          currentPage={pagination.currentPage - 1} // Convert to 0-based
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          pageSize={pagination.pageSize}
          isFirstPage={pagination.isFirstPage}
          isLastPage={pagination.isLastPage}
          onPageChange={(page) => onPageChange?.(page)}
          onFirst={() => onFirstPage?.()}
          onPrevious={() => onPreviousPage?.()}
          onNext={() => onNextPage?.()}
          onLast={() => onLastPage?.()}
        />
      )}

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
    </div>
  )
}
