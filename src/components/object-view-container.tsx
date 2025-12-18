'use client'

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
  showDeleted?: boolean
}

export function ObjectViewContainer({
  viewType,
  viewData,
  onViewObject,
  onObjectDoubleClick,
  showDeleted = false,
}: ObjectViewContainerProps) {
  switch (viewType) {
    case 'table': {
      if (viewData.type !== 'table') {
        logger.error('Expected table data but received:', viewData.type)
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
        />
      )
    }

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
          fetching={viewData.fetching} // Pass fetching state for internal loading
          onViewObject={onViewObject}
          onObjectDoubleClick={onObjectDoubleClick}
          pagination={{
            currentPage: viewData.pagination.currentPage + 1, // Convert to 1-based for display
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
        />
      )
    }
  }
}
