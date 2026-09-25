'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusCircle, Copy, FileText } from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import { cn } from '@/lib/utils'
import { useBreadcrumbTrail } from '@/hooks/data/use-breadcrumb-trail'
import { useObjects } from '@/hooks/api/entities'
import { useColumnVisibility } from '@/hooks/ui/use-column-visibility'
import { usePreference } from '@/hooks/ui/use-preference'
import { Badge, SplitButton } from '@/components/ui'
import { FilterMenu, deletedSection } from '@/components/filters'
import { ObjectBreadcrumb } from '../components/object-breadcrumb'
import { ViewSelector } from '@/components/view-selector'
import { ObjectColumnsView } from '../components/columns-view'
import {
  DataTableColumnToggle,
  EntityTable,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/entity-list'
import { ContentSkeleton } from '@/components/skeletons'

import { ObjectBulkBar } from '../components/object-bulk-bar'
import { ObjectRowPortals } from '../components/object-row-portals'
import { OBJECT_TOGGLEABLE_COLUMNS } from '../components/object-columns'
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
  // The SAME preference as /objects: one table shape, one setting. Two keys for
  // one set of columns would surprise anyone who hid a column on the list and
  // found it back on a child page.
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    'objectColumnsHidden'
  )
  // Shares `objectsView` with /objects: the view is a way of reading objects,
  // not a property of one page, so switching should not depend on where you
  // switched it.
  const [viewType, setViewType] = usePreference('objectsView')

  const { data: childrenPage, isFetching } = useList(
    {
      ...listQuery.query,
      parent: parentUuid,
      size: filters.pageSize,
      // The node defaults objects to `scope: 'mine'`, which drops children of a
      // shared parent — the row's childCount honours access, so it still counts them.
      scope: 'all',
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
              <h1
                className={cn(
                  'text-2xl font-bold',
                  parentObject.deleted && 'text-destructive line-through'
                )}
              >
                {parentObject.name}
              </h1>
              {parentObject.deleted && (
                <Badge
                  variant="outline"
                  className="border-destructive text-destructive"
                  data-testid="parent-deleted-badge"
                >
                  {t('common.deleted')}
                </Badge>
              )}
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
            {parentObject.deleted && (
              <p
                className="mt-1 text-sm text-destructive"
                data-testid="parent-deleted-hint"
              >
                {t('objects.childrenPage.parentDeleted')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <FilterMenu
              sections={[
                deletedSection(t, filters.showDeleted, filters.setShowDeleted),
              ]}
              {...anchor('filters')}
            />
            {viewType === 'table' && (
              <DataTableColumnToggle
                columns={[...OBJECT_TOGGLEABLE_COLUMNS]}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
              />
            )}
            <ViewSelector view={viewType} onChange={setViewType} />
            <SplitButton
              size="sm"
              onClick={() => setIsAddSheetOpen(true)}
              menuLabel={t('objects.childrenPage.moreChildActions')}
              actions={[
                {
                  key: 'copy-here',
                  label: t('objects.duplicate.copyHere'),
                  icon: <Copy className="mr-2 h-4 w-4" />,
                  onSelect: () => setIsCopyHereOpen(true),
                },
              ]}
              data-testid="page-header-add-child-button"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('objects.childrenPage.addChild')}
            </SplitButton>
          </div>
        </div>

        {viewType === 'columns' ? (
          <ObjectColumnsView
            rootId={parentUuid}
            rootLabel={parentObject.name}
            showDeleted={filters.showDeleted}
            // Hardcoded, exactly as the table query is: the node defaults to
            // `mine`, which drops children of a shared parent.
            scope="all"
            isRestoring={state.isRestoring}
            onViewObject={state.openDetails}
            onDelete={state.setObjectToDelete}
            onDuplicate={state.setDuplicateTarget}
            onShowQRCode={state.setQrTarget}
            onCreateTemplate={state.templateFromObject.setSource}
            onRestore={state.handleRestore}
          />
        ) : (
          <EntityTable
            columns={state.columns}
            columnVisibility={columnVisibility}
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
            pageSize={filters.pageSize}
            onRowDoubleClick={handleDoubleClick}
            emptyIcon={
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('objects.childrenPage.noChildrenTitle')}
            emptyDescription={t('objects.childrenPage.noChildrenDescription')}
          />
        )}
      </div>

      {/* Column view has no row selection, so the bar must not claim a stale
          table selection. */}
      <ObjectBulkBar
        state={state}
        count={viewType === 'table' ? (state.selectedObjects?.length ?? 0) : 0}
      />
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
