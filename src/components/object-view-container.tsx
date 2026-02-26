'use client'

import type { RowSelectionState, VisibilityState } from '@tanstack/react-table'

import { logger } from '@/lib'
import { ViewData } from '@/hooks'
import { ObjectsTable } from '@/components/tables'
import { ViewType } from '@/components/view-selector'
import { ObjectColumnsView } from '@/components/object-columns-view'

interface ObjectViewContainerProps {
  viewType: ViewType
  viewData: ViewData
  onViewObject?: (object: any) => void
  onObjectDoubleClick?: (object: any) => void
  onDuplicate?: (object: any) => void
  showDeleted?: boolean
  // Selection
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  enableRowSelection?: boolean
  // Column visibility
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  // Page size
  onPageSizeChange?: (size: number) => void
}

export function ObjectViewContainer({
  viewType,
  viewData,
  onViewObject,
  onObjectDoubleClick,
  onDuplicate,
  showDeleted = false,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection = false,
  columnVisibility,
  onColumnVisibilityChange,
  onPageSizeChange,
}: ObjectViewContainerProps) {
  const tableProps = {
    rowSelection,
    onRowSelectionChange,
    enableRowSelection,
    columnVisibility,
    onColumnVisibilityChange,
    onPageSizeChange,
  }

  switch (viewType) {
    case 'columns': {
      if (viewData.type !== 'columns') {
        logger.error('Expected columns data but received:', viewData.type)
        return null
      }

      return (
        <ObjectColumnsView
          data={viewData.rootObjects}
          fetching={viewData.fetching}
          rootPagination={viewData.rootPagination}
          onViewObject={onViewObject}
          onDuplicate={onDuplicate}
          showDeleted={showDeleted}
        />
      )
    }

    default: {
      // Default to table view
      if (viewData.type !== 'table') {
        logger.error(
          'Expected table data for default case but received:',
          viewData.type
        )
        return null
      }

      return (
        <ObjectsTable
          initialData={viewData.data}
          fetching={viewData.fetching}
          onViewObject={onViewObject}
          onObjectDoubleClick={onObjectDoubleClick}
          pagination={{
            currentPage: viewData.pagination.currentPage + 1,
            totalPages: viewData.pagination.totalPages,
            totalElements: viewData.pagination.totalElements,
            pageSize: viewData.pagination.pageSize,
            isFirstPage: viewData.pagination.isFirstPage,
            isLastPage: viewData.pagination.isLastPage,
          }}
          onPageChange={viewData.pagination.handlePageChange}
          onFirstPage={viewData.pagination.handleFirst}
          onPreviousPage={viewData.pagination.handlePrevious}
          onNextPage={viewData.pagination.handleNext}
          onLastPage={viewData.pagination.handleLast}
          {...tableProps}
        />
      )
    }
  }
}
