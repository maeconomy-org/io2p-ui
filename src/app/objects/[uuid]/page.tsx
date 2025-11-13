'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PlusCircle, ArrowLeft } from 'lucide-react'

import { useAggregate } from '@/hooks'
import { Button } from '@/components/ui'
import { ObjectsTable } from '@/components/tables'
import { isObjectDeleted } from '@/lib'
import ProtectedRoute from '@/components/protected-route'
import { ObjectDetailsSheet, ObjectAddSheet } from '@/components/object-sheets'

function ObjectChildrenPageContent() {
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  // Pagination state for children
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(15)

  // Hooks
  const { useAggregateByUUID, useAggregateEntities } = useAggregate()

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
    if (parentData && parentData.length > 0) {
      return parentData[0]
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

  // State
  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false)
  const [isObjectEditSheetOpen, setIsObjectEditSheetOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<any>(null)

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
  const handleObjectDoubleClick = (object: any) => {
    if (object.hasChildren) {
      router.push(`/objects/${object.uuid}`)
    } else {
      handleViewObject(object)
    }
  }

  const handleAddChild = () => {
    setSelectedObject(null)
    setIsObjectEditSheetOpen(true)
  }

  if (parentLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        Loading parent object...
      </div>
    )
  }

  if (!parentObject) {
    return (
      <div className="flex flex-col flex-1">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-40">
            <p>Parent object not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-4">
        {/* Header with parent info and back button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/objects')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Objects
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{parentObject.name}</h1>
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {parentObject.uuid}
              </p>
            </div>
          </div>

          <Button onClick={handleAddChild}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Child
          </Button>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold">Children Objects</h2>
          <p className="text-sm text-muted-foreground">
            {totalElements} child objects found
          </p>
        </div>

        {/* Children Table */}
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
          onPreviousPage={() => setCurrentPage(Math.max(0, currentPage - 1))}
          onNextPage={() =>
            setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
          }
          onLastPage={() => setCurrentPage(totalPages - 1)}
        />
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
      />
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
