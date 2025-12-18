import { PencilIcon, TrashIcon, FileText, RotateCcw } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  TablePagination,
} from '@/components/ui'
import { isObjectDeleted, logger } from '@/lib'
import { useObjects } from '@/hooks'

interface ObjectModelsTableProps {
  models: any[]
  onEdit: (model: any) => void
  onDelete: (object: { uuid: string; name: string }) => void
  onRevert?: (model: any) => void
  loading?: boolean
  fetching?: boolean
  pagination?: {
    currentPage: number
    totalPages: number
    totalElements: number
    pageSize: number
    isFirstPage: boolean
    isLastPage: boolean
    handlePageChange: (page: number) => void
    handleFirst: () => void
    handlePrevious: () => void
    handleNext: () => void
    handleLast: () => void
  }
}

export function ObjectModelsTable({
  models,
  onEdit,
  onDelete,
  onRevert,
  loading = false,
  fetching = false,
  pagination,
}: ObjectModelsTableProps) {
  // Revert functionality
  const { useRevertObject } = useObjects()
  const revertObjectMutation = useRevertObject()

  const handleRevertModel = async (model: any) => {
    try {
      await revertObjectMutation.mutateAsync({
        uuid: model.uuid,
        name: model.name,
        abbreviation: model.abbreviation,
        version: model.version,
        description: model.description,
        isTemplate: true, // Always true for models/templates
      })
      if (onRevert) {
        onRevert(model)
      }
    } catch (error) {
      logger.error('Error reverting model:', error)
    }
  }
  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Abbreviation</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>UUID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-center py-8" {...{ colSpan: 6 }}>
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2"></div>
                    Loading templates...
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>UUID</TableHead>
              <TableHead>Created</TableHead>
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
            ) : models.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-8" {...{ colSpan: 6 }}>
                  <div className="flex flex-col items-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No Templates Found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      There are no templates to display
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => {
                const deleted = isObjectDeleted(model)
                return (
                  <TableRow
                    key={model.uuid}
                    className={deleted ? 'bg-red-50 border-red-200' : ''}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={deleted ? 'line-through text-red-600' : ''}
                        >
                          {model.name}
                        </span>
                        {deleted && (
                          <Badge variant="destructive" className="text-xs">
                            Deleted
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={deleted ? 'line-through text-red-600' : ''}
                    >
                      {model.abbreviation}
                    </TableCell>
                    <TableCell
                      className={deleted ? 'line-through text-red-600' : ''}
                    >
                      {model.version}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-xs text-muted-foreground ${deleted ? 'line-through text-red-600' : ''}`}
                    >
                      {model.uuid}
                    </TableCell>
                    <TableCell
                      className={deleted ? 'line-through text-red-600' : ''}
                    >
                      {new Date(model.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(model)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        {deleted ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevertModel(model)}
                            disabled={revertObjectMutation.isPending}
                            title="Restore model"
                          >
                            <RotateCcw className="h-4 w-4 text-blue-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onDelete({ uuid: model.uuid, name: model.name })
                            }
                          >
                            <TrashIcon className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <TablePagination
          currentPage={pagination.currentPage + 1} // Convert to 1-based for UI
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          pageSize={pagination.pageSize}
          onPageChange={(page) => pagination.handlePageChange(page - 1)} // Convert to 0-based for API
          onFirst={() => pagination.handleFirst()}
          onPrevious={() => pagination.handlePrevious()}
          onNext={() => pagination.handleNext()}
          onLast={() => pagination.handleLast()}
          isFirstPage={pagination.isFirstPage}
          isLastPage={pagination.isLastPage}
        />
      )}
    </div>
  )
}
