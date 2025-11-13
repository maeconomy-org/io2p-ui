'use client'

import { FileText } from 'lucide-react'
import { DeleteConfirmationDialog } from '@/components/modals'

import { getColumnTitle } from './utils'
import { ObjectColumn } from './components'
import { useColumnsData } from './hooks/use-columns-data'
import { useLoadChildren } from './hooks/use-load-children'

interface ObjectColumnsViewProps {
  data: any[]
  fetching?: boolean
  rootPagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  onViewObject?: (object: any) => void
}

export function ObjectColumnsView({
  data,
  fetching = false,
  rootPagination,
  onViewObject,
}: ObjectColumnsViewProps) {
  // Create loadChildren function locally for columns view
  const { loadChildren } = useLoadChildren()
  // Use the centralized columns data hook
  const {
    columns,
    selectedIds,
    handleSelectItem,
    getPaginationForColumn,
    getRootColumnPagination,
    handleColumnPageChangeWrapper,
    isColumnLoadingOrSearching,
    handleColumnSearchChange,
    getSearchTermForColumn,
    isDeleteModalOpen,
    objectToDelete,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useColumnsData({
    data,
    loadChildren,
    rootPagination,
    fetching,
  })

  // Simple handler functions (delegating to props)
  const handleShowDetails = (item: any) => {
    if (onViewObject) {
      onViewObject(item)
    }
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Columns container */}
        <div className="border rounded-md overflow-hidden flex-1">
          <div className="flex h-full overflow-x-auto">
            {columns.map((items: any[], index: number) => {
              // Root column (index 0) uses special pagination that accounts for search
              const isRootColumn = index === 0
              const paginationInfo = isRootColumn
                ? getRootColumnPagination()
                : getPaginationForColumn(index)

              return (
                <ObjectColumn
                  key={index}
                  items={items}
                  selectedId={selectedIds[index] || null}
                  isLoading={isColumnLoadingOrSearching(index)}
                  pagination={
                    paginationInfo
                      ? {
                          currentPage: paginationInfo.currentPage,
                          totalPages: paginationInfo.totalPages,
                          totalItems: paginationInfo.totalItems,
                          onPageChange: (page) => {
                            if (isRootColumn) {
                              // Root column uses its own onPageChange function
                              ;(paginationInfo as any).onPageChange(page)
                            } else {
                              // Child columns use the column page change handler
                              handleColumnPageChangeWrapper(index, page)
                            }
                          },
                        }
                      : undefined
                  }
                  onSelect={(item) => handleSelectItem(item, index)}
                  onShowDetails={handleShowDetails}
                  onDelete={(item) =>
                    handleDelete({ uuid: item.uuid, name: item.name })
                  }
                  searchTerm={getSearchTermForColumn(index)}
                  onSearchChange={(searchTerm) =>
                    handleColumnSearchChange(index, searchTerm)
                  }
                  columnTitle={getColumnTitle(index)}
                />
              )
            })}

            {/* Show loading column for children being fetched */}
            {/* This part would need access to column pagination, so we'll keep it simple for now */}

            {/* Empty state for when no columns have content */}
            {columns.length === 0 && (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
                <div>
                  <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No Objects Found</h3>
                  <p className="text-sm">
                    Load some data to start exploring the object hierarchy
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Delete Confirmation Dialog */}
      {isDeleteModalOpen && objectToDelete && (
        <DeleteConfirmationDialog
          open={isDeleteModalOpen}
          onOpenChange={handleDeleteCancel}
          objectName={objectToDelete.name}
          onDelete={handleDeleteConfirm}
        />
      )}
    </>
  )
}
