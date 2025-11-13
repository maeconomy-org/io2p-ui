'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Search, X } from 'lucide-react'

import { useViewData } from '@/hooks'
import { Button, Badge, DeletedFilter } from '@/components/ui'
import { isObjectDeleted } from '@/lib'
import ProtectedRoute from '@/components/protected-route'
import { ViewSelector, ViewType } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'
import { ObjectDetailsSheet, ObjectAddSheet } from '@/components/object-sheets'
import { useSearch } from '@/contexts/search-context'

function ObjectsPageContent() {
  const [viewType, setViewType] = useState<ViewType>('table')
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

  const router = useRouter()
  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  // Use the data adapter hook - handles all data fetching internally
  const viewData = useViewData({ viewType })

  // Initialize view type from localStorage after the component mounts
  useEffect(() => {
    const savedView = localStorage.getItem('view')
    if (savedView && (savedView === 'table' || savedView === 'columns')) {
      setViewType(savedView as ViewType)
    } else {
      // Default to table if saved view is invalid or explorer
      setViewType('table')
      localStorage.setItem('view', 'table')
    }
  }, [])

  const handleAddObject = () => {
    setSelectedObject(null)
    setIsObjectEditSheetOpen(true)
  }

  const handleViewObject = (object: any) => {
    setSelectedObject(object)
    setIsObjectSheetOpen(true)
  }

  // Handle double-click to navigate to children page
  const handleObjectDoubleClick = (object: any) => {
    if (object.hasChildren) {
      router.push(`/objects/${object.uuid}`)
    } else {
      // For objects without children, just open details
      handleViewObject(object)
    }
  }

  return (
    <div className="container mx-auto py-4 px-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Objects</h1>
          </div>
          <div className="flex items-center gap-4">
            <DeletedFilter
              showDeleted={showDeleted}
              onShowDeletedChange={setShowDeleted}
              label="Show deleted objects"
            />
            <ViewSelector
              view={viewType}
              onChange={(value: ViewType) => {
                setViewType(value)
                localStorage.setItem('view', value)
              }}
            />
            <Button onClick={handleAddObject}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Object
            </Button>
          </div>
        </div>

        {/* Search Mode Indicator */}
        {isSearchMode && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-900 truncate">
                    Search Results for: "{searchQuery}"
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700 whitespace-nowrap"
                >
                  {searchPagination
                    ? `${searchPagination.totalElements} result${searchPagination.totalElements !== 1 ? 's' : ''} (page ${searchPagination.currentPage + 1} of ${searchPagination.totalPages})`
                    : `${searchViewResults.length} result${searchViewResults.length !== 1 ? 's' : ''}`}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 flex-shrink-0"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Search
              </Button>
            </div>
          </div>
        )}

        <ObjectViewContainer
          viewType={viewType}
          viewData={viewData}
          onViewObject={handleViewObject}
          onObjectDoubleClick={handleObjectDoubleClick}
        />
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
