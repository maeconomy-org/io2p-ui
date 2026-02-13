'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { PlusCircle, Copy, FolderOpen, HomeIcon } from 'lucide-react'
import Link from 'next/link'

import { useAggregate, useBreadcrumbTrail } from '@/hooks'
import {
  Button,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { isObjectDeleted } from '@/lib'
import { ObjectsTable } from '@/components/tables'
import ProtectedRoute from '@/components/protected-route'
import { ContentSkeleton } from '@/components/skeletons'
import {
  ObjectDetailsSheet,
  ObjectAddSheet,
  CopyObjectsSheet,
} from '@/components/object-sheets'

// Truncate text with ellipsis and show full text on hover using Radix tooltip
function TruncateWithTooltip({
  text,
  maxLength,
}: {
  text: string
  maxLength: number
}) {
  const shouldTruncate = text.length > maxLength
  const displayText = shouldTruncate ? text.slice(0, maxLength) + '...' : text

  if (!shouldTruncate) {
    return <>{displayText}</>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{displayText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ObjectChildrenPageContent() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  // Pagination state for children
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(15)

  // Hooks
  const { useAggregateByUUID, useAggregateEntities } = useAggregate()
  const { ancestors, pushAncestor, navigateToAncestor, clearTrail } =
    useBreadcrumbTrail(parentUuid)

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
    if (parentData) {
      return parentData
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

  // Copy objects state
  const [isCopySheetOpen, setIsCopySheetOpen] = useState(false)

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
  const handleObjectDoubleClick = useCallback(
    (object: any) => {
      // Push the current parent onto the breadcrumb trail before navigating
      if (parentObject) {
        pushAncestor({
          uuid: parentUuid,
          name: (parentObject.name || parentUuid) as string,
        })
      }
      router.push(`/objects/${object.uuid}`)
    },
    [parentObject, parentUuid, pushAncestor, router]
  )

  // Truncate breadcrumb: show first 3 + ... + last 3 when > 6 ancestors
  const MAX_VISIBLE = 4
  const EDGE_COUNT = 2

  const truncatedAncestors = useMemo(() => {
    if (ancestors.length <= MAX_VISIBLE) {
      return { leading: ancestors, trailing: [], truncated: false }
    }
    return {
      leading: ancestors.slice(0, EDGE_COUNT),
      trailing: ancestors.slice(-1),
      truncated: true,
    }
  }, [ancestors])

  const handleAddChild = () => {
    setSelectedObject(null)
    setIsObjectEditSheetOpen(true)
  }

  if (parentLoading) {
    return <ContentSkeleton />
  }

  if (!parentObject) {
    return (
      <div className="flex flex-col flex-1">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-40">
            <p>{t('objects.childrenPage.parentNotFound')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-4">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/objects"
                  className="flex items-center gap-2"
                  onClick={() => clearTrail()}
                >
                  <HomeIcon className="size-4" />
                  {t('objects.childrenPage.breadcrumbRoot')}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {truncatedAncestors.leading.map((ancestor) => (
              <span key={ancestor.uuid} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/objects/${ancestor.uuid}`}
                      onClick={() => navigateToAncestor(ancestor.uuid)}
                    >
                      <TruncateWithTooltip
                        text={ancestor.name}
                        maxLength={25}
                      />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </span>
            ))}
            {truncatedAncestors.truncated && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
                {truncatedAncestors.trailing.map((ancestor) => (
                  <span key={ancestor.uuid} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          href={`/objects/${ancestor.uuid}`}
                          onClick={() => navigateToAncestor(ancestor.uuid)}
                        >
                          <TruncateWithTooltip
                            text={ancestor.name}
                            maxLength={25}
                          />
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </span>
                ))}
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                <TruncateWithTooltip
                  text={parentObject.name || parentUuid}
                  maxLength={25}
                />
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header with parent info */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{parentObject.name}</h1>
              <p className="text-sm font-medium text-muted-foreground">
                (
                {t('objects.childrenPage.childrenCount', {
                  count: totalElements,
                })}
                )
              </p>
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {parentObject.uuid}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCopySheetOpen(true)}>
              <Copy className="mr-2 h-4 w-4" />
              {t('objects.duplicate.copyHere')}
            </Button>
            <Button onClick={handleAddChild}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('objects.childrenPage.addChild')}
            </Button>
          </div>
        </div>

        {/* Children Table or Empty State */}
        {!childrenLoading && childrenData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t('objects.childrenPage.noChildrenTitle')}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              {t('objects.childrenPage.noChildrenDescription')}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCopySheetOpen(true)}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('objects.duplicate.copyHere')}
              </Button>
              <Button onClick={handleAddChild}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('objects.childrenPage.addChild')}
              </Button>
            </div>
          </div>
        ) : (
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
        )}
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
        defaultParentUuids={[parentUuid]}
      />

      {/* Copy Objects Sheet */}
      {isCopySheetOpen && (
        <CopyObjectsSheet
          open={isCopySheetOpen}
          onOpenChange={setIsCopySheetOpen}
          defaultParentUuid={parentUuid}
        />
      )}
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
