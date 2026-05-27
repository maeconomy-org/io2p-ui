'use client'

import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmationDialog } from '@/components/modals'

import { getColumnTitle } from './utils'
import { ObjectColumn } from './components'
import { useColumnsData } from './hooks/use-columns-data'
import { useLoadChildren } from './hooks/use-load-children'

interface DraftColumnRow {
  id: string
  name: string
  updatedAt: number
}

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
  onDuplicate?: (object: any) => void
  showDeleted?: boolean
  readOnly?: boolean
  // Pinned draft rows for the root column (UI-only, no backend uuid).
  draftRows?: DraftColumnRow[]
  onOpenDraft?: (id: string) => void
  onDiscardDraft?: (id: string) => void
  // Object-level actions hoisted to the page so both views share a single
  // modal instance (matches the onViewObject pattern).
  onShowQRCode?: (object: any) => void
  onViewPassport?: (object: any) => void
  onCreateTemplate?: (object: any) => void
  onRestore?: (object: any) => void
  isRestoring?: boolean
}

export function ObjectColumnsView({
  data,
  fetching = false,
  rootPagination,
  onViewObject,
  onDuplicate,
  showDeleted = false,
  readOnly = false,
  draftRows,
  onOpenDraft,
  onDiscardDraft,
  onShowQRCode,
  onViewPassport,
  onCreateTemplate,
  onRestore,
  isRestoring = false,
}: ObjectColumnsViewProps) {
  const t = useTranslations()
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
    showDeleted,
  })

  // Simple handler functions (delegating to props)
  const handleShowDetails = (item: any) => {
    if (onViewObject) {
      onViewObject(item)
    }
  }

  // When the server has no root objects but the user has unsaved drafts,
  // synthesize an empty root column so the draft-prepend logic below has
  // something to iterate. Without this, columns.length === 0 short-circuits
  // to the empty state and drafts never render — diverging from table view.
  const hasDrafts = !!(draftRows && draftRows.length > 0)
  const effectiveColumns =
    columns.length === 0 && hasDrafts ? [[] as any[]] : columns

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Columns container */}
        <div className="border rounded-md overflow-hidden flex-1">
          <div className="flex h-full overflow-x-auto">
            {effectiveColumns.map((items: any[], index: number) => {
              // Root column (index 0) uses special pagination that accounts for search
              const isRootColumn = index === 0
              const paginationInfo = isRootColumn
                ? getRootColumnPagination()
                : getPaginationForColumn(index)

              // Prepend pinned drafts only to the root column. Drafts are
              // UI-only entries surfaced by the parent page; child columns
              // never receive them because drafts have no parent context.
              const itemsWithDrafts =
                isRootColumn && draftRows && draftRows.length > 0
                  ? [
                      ...draftRows.map((d) => ({
                        __isDraft: true as const,
                        __draftId: d.id,
                        uuid: d.id,
                        name: d.name,
                        updatedAt: d.updatedAt,
                      })),
                      ...items,
                    ]
                  : items

              return (
                <ObjectColumn
                  key={`column-${index}`}
                  items={itemsWithDrafts}
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
                  onDelete={
                    readOnly
                      ? undefined
                      : (item) =>
                          handleDelete({ uuid: item.uuid, name: item.name })
                  }
                  onDuplicate={readOnly ? undefined : onDuplicate}
                  onShowQRCode={onShowQRCode}
                  onViewPassport={onViewPassport}
                  onCreateTemplate={readOnly ? undefined : onCreateTemplate}
                  onRestore={readOnly ? undefined : onRestore}
                  isRestoring={isRestoring}
                  searchTerm={getSearchTermForColumn(index)}
                  onSearchChange={(searchTerm) =>
                    handleColumnSearchChange(index, searchTerm)
                  }
                  columnTitle={getColumnTitle(index, t)}
                  onOpenDraft={isRootColumn ? onOpenDraft : undefined}
                  onDiscardDraft={isRootColumn ? onDiscardDraft : undefined}
                />
              )
            })}

            {/* Show loading column for children being fetched */}
            {/* This part would need access to column pagination, so we'll keep it simple for now */}

            {/* Empty state for when no columns have content */}
            {effectiveColumns.length === 0 && (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
                <div>
                  <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">
                    {t('objects.columnsView.noObjects')}
                  </h3>
                  <p className="text-sm">{t('objects.columnsView.loadData')}</p>
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
