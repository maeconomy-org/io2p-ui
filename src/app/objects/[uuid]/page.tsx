'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, Copy, FileText } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import { useBreadcrumbTrail } from '@/hooks/data/use-breadcrumb-trail'
import { useObjects } from '@/hooks/api/entities'
import { Button } from '@/components/ui'
import { FilterMenu, deletedSection } from '@/components/filters'
import { ObjectBreadcrumb } from '../components/object-breadcrumb'
import {
  EntityTable,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/tables'
import { ContentSkeleton } from '@/components/skeletons'

import { ObjectBulkBar } from '../components/object-bulk-bar'
import { ObjectRowPortals } from '../components/object-row-portals'
import { useObjectListPage } from '../components/use-object-list-page'
import { anchor } from '@/constants'

const EntitySheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.EntitySheet),
  { ssr: false }
)
const DuplicateObjectsSheet = dynamic(
  () =>
    import('@/app/objects/components/duplicate-objects/duplicate-objects-sheet').then(
      (mod) => mod.DuplicateObjectsSheet
    ),
  { ssr: false }
)

export default function ObjectChildrenPage() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const parentUuid = params.uuid as string

  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [isCopyHereOpen, setIsCopyHereOpen] = useState(false)

  const { ancestors, pushAncestor, navigateToAncestor, clearTrail } =
    useBreadcrumbTrail(parentUuid)

  const { useGet, useList } = useObjects()
  const { data: parentObject, isLoading: parentLoading } = useGet(parentUuid)

  const listQuery = useEntityListQuery()
  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  const { data: childrenPage, isFetching } = useList(
    {
      ...listQuery.query,
      parent: parentUuid,
      size: filters.pageSize,
      deleted: filters.showDeleted ? 'include' : undefined,
      withChildCounts: true,
    },
    { enabled: !!parentUuid, keepPreviousData: true }
  )

  const state = useObjectListPage({ page: childrenPage })

  const handleDoubleClick = useCallback(
    (object: ObjectListItem) => {
      if (parentObject) {
        pushAncestor({ uuid: parentUuid, name: parentObject.name })
      }
      router.push(`/objects/${object.id}`)
    },
    [parentObject, parentUuid, pushAncestor, router]
  )

  if (parentLoading) {
    return <ContentSkeleton />
  }

  if (!parentObject) {
    return (
      <div className="container mx-auto px-4">
        <div className="flex h-40 items-center justify-center">
          <p>{t('objects.childrenPage.parentNotFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col space-y-4">
        <ObjectBreadcrumb
          currentObject={{ uuid: parentUuid, name: parentObject.name }}
          ancestors={ancestors}
          onNavigateToAncestor={navigateToAncestor}
          onNavigateToRoot={clearTrail}
        />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{parentObject.name}</h1>
              <p className="text-sm font-medium text-muted-foreground">
                (
                {t('objects.childrenPage.childrenCount', {
                  count: childrenPage?.page.totalElements ?? 0,
                })}
                )
              </p>
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {parentObject.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <FilterMenu
              sections={[
                deletedSection(t, filters.showDeleted, filters.setShowDeleted),
              ]}
              {...anchor('filters')}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCopyHereOpen(true)}
              data-testid="page-header-copy-button"
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('objects.duplicate.copyHere')}
            </Button>
            <Button size="sm" onClick={() => setIsAddSheetOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('objects.childrenPage.addChild')}
            </Button>
          </div>
        </div>

        <EntityTable
          columns={state.columns}
          page={childrenPage}
          getRowId={(o) => o.id}
          fetching={isFetching}
          enableRowSelection
          rowSelection={state.rowSelection}
          onRowSelectionChange={state.setRowSelection}
          sort={listQuery.query.sort}
          onSortChange={listQuery.setSort}
          onPageChange={listQuery.setPage}
          onPageSizeChange={filters.handlePageSizeChange}
          onRowDoubleClick={handleDoubleClick}
          emptyIcon={
            <FileText className="h-10 w-10 text-muted-foreground/50" />
          }
          emptyTitle={t('objects.childrenPage.noChildrenTitle')}
          emptyDescription={t('objects.childrenPage.noChildrenDescription')}
        />
      </div>

      <ObjectBulkBar state={state} />
      <ObjectRowPortals state={state} />

      {/* "Add child" creates the CHILD with this page's object as its parent — io2p hangs the
          edge off the child, so there is nothing to PATCH on the parent. */}
      {isAddSheetOpen && (
        <EntitySheet
          open={isAddSheetOpen}
          onOpenChange={setIsAddSheetOpen}
          defaultParentIds={[parentUuid]}
          defaultParentNames={{ [parentUuid]: parentObject.name }}
        />
      )}

      {isCopyHereOpen && (
        <DuplicateObjectsSheet
          open={isCopyHereOpen}
          onOpenChange={setIsCopyHereOpen}
          defaultParentUuid={parentUuid}
        />
      )}
    </div>
  )
}
