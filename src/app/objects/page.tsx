'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import dynamic from 'next/dynamic'
import { useViewData, useBreadcrumbTrail } from '@/hooks'
import { useSearch } from '@/contexts'
import { isObjectDeleted } from '@/lib'
import ProtectedRoute from '@/components/protected-route'
import InitialLoginTour from '@/components/onboarding/initial-login-tour'
import { Button, Badge, DeletedFilter } from '@/components/ui'
import { ViewSelector, ViewType } from '@/components/view-selector'
import { ObjectViewContainer } from '@/components/object-view-container'

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

function ObjectsPageContent() {
  const t = useTranslations()
  const [viewType, setViewType] = useState<ViewType>('table')
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)
  const [showDeleted, setShowDeleted] = useState<boolean>(false)

  // Copy objects state (for columns view — table handles its own)
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<any>(null)

  const router = useRouter()
  const { clearTrail } = useBreadcrumbTrail(undefined)
  const {
    isSearchMode,
    searchQuery,
    searchViewResults,
    searchPagination,
    clearSearch,
  } = useSearch()

  // Use the data adapter hook - handles all data fetching internally
  const viewData = useViewData({ viewType, showDeleted })

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
  const handleObjectDoubleClick = useCallback(
    (object: any) => {
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
              label={t('objects.showDeleted')}
              data-tour="filters"
            />
            <ViewSelector
              view={viewType}
              onChange={(value: ViewType) => {
                setViewType(value)
                localStorage.setItem('view', value)
              }}
              data-tour="view-selector"
            />
            <Button onClick={handleAddObject} data-tour="create-object">
              <PlusCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('objects.create')}</span>
            </Button>
          </div>
        </div>

        {/* Search Mode Indicator */}
        {isSearchMode && (
          <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {t('objects.searchResults', { query: searchQuery })}
                  </span>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {searchPagination
                    ? t('objects.resultsPage', {
                        count: searchPagination.totalElements,
                        page: searchPagination.currentPage + 1,
                        pages: searchPagination.totalPages,
                      })
                    : t('objects.results', {
                        count: searchViewResults.length,
                      })}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4 mr-1" />
                {t('objects.clearSearch')}
              </Button>
            </div>
          </div>
        )}

        <ObjectViewContainer
          viewType={viewType}
          viewData={viewData}
          onViewObject={handleViewObject}
          onObjectDoubleClick={handleObjectDoubleClick}
          onDuplicate={(object) => {
            setCopyTarget(object)
            setIsCopySheetOpen(true)
          }}
          showDeleted={showDeleted}
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

      {/* Copy Objects Sheet (columns view) */}
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
