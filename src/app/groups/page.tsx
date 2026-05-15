'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { GroupCreateDTO } from 'iom-sdk'
import { Loader2, PlusCircle, FolderOpen } from 'lucide-react'
import dynamic from 'next/dynamic'

import { logger } from '@/lib'
import {
  Button,
  EmptyState,
  GridPagination,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui'
import { FacetedFilter } from '@/components/filters'
import { GroupCard } from '@/components/groups'

// Lazy-load sheet components (only rendered on user interaction)
const GroupViewSheet = dynamic(
  () =>
    import('@/components/groups/components/group-view-sheet').then(
      (mod) => mod.GroupViewSheet
    ),
  { ssr: false }
)

const GroupCreateSheet = dynamic(
  () =>
    import('@/components/groups/components/group-create-sheet').then(
      (mod) => mod.GroupCreateSheet
    ),
  { ssr: false }
)
import { useGroups } from '@/hooks/api'

type GroupFilter = 'all' | 'my' | 'shared'

const ITEMS_PER_PAGE = 12

export default function GroupsPage() {
  const t = useTranslations()
  const { useListGroups, useListOwnGroups, useListSharedGroups } = useGroups()

  const [selectedGroup, setSelectedGroup] = useState<GroupCreateDTO | null>(
    null
  )
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<GroupCreateDTO | null>(
    null
  )

  // Pagination + filter state
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all')

  // API is 0-indexed; only the active filter's query runs
  const queryParams = { page: currentPage - 1, size: ITEMS_PER_PAGE }
  const allQuery = useListGroups(queryParams, {
    enabled: activeFilter === 'all',
  })
  const ownQuery = useListOwnGroups(queryParams, {
    enabled: activeFilter === 'my',
  })
  const sharedQuery = useListSharedGroups(queryParams, {
    enabled: activeFilter === 'shared',
  })

  const activeQuery =
    activeFilter === 'my'
      ? ownQuery
      : activeFilter === 'shared'
        ? sharedQuery
        : allQuery

  const { data: page, isLoading, isError, isFetching } = activeQuery

  const groups = page?.content ?? []
  const totalPages = page?.totalPages ?? 0
  const totalElements = page?.totalElements ?? 0

  const handleFilterChange = useCallback((filter: GroupFilter) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
  }, [])

  const handleViewGroup = (group: GroupCreateDTO) => {
    setSelectedGroup(group)
    setIsViewSheetOpen(true)
  }

  const handleCreateGroup = () => {
    setIsCreateSheetOpen(true)
  }

  const handleDeleteGroup = useCallback((group: GroupCreateDTO) => {
    setGroupToDelete(group)
  }, [])

  const handleConfirmDeleteGroup = useCallback(() => {
    if (!groupToDelete) return
    logger.info('Deleting group:', { uuid: groupToDelete.groupUUID })
    // TODO: call delete API when available
    logger.info('Group deleted (soft delete)')
    setGroupToDelete(null)
  }, [groupToDelete])

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold shrink-0">{t('groups.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
          {/* Quick filter dropdown */}
          <FacetedFilter
            title={t('groups.filter.label')}
            options={[
              { value: 'all', label: t('groups.filter.all') },
              { value: 'my', label: t('groups.filter.my') },
              { value: 'shared', label: t('groups.filter.shared') },
            ]}
            selected={[activeFilter]}
            onSelectionChange={(values) => {
              // If clicking the currently active filter to deselect, reset to 'all'
              if (values.length === 0) {
                handleFilterChange('all')
                return
              }
              // Pick the newly selected value (the one that wasn't previously active)
              const newValue =
                values.find((v) => v !== activeFilter) ?? values[0]
              handleFilterChange((newValue as GroupFilter) || 'all')
            }}
            showSearch={false}
            clearLabel={t('common.clearFilters')}
          />
          {/* Create */}
          <Button
            data-testid="create-group-button"
            size="sm"
            onClick={handleCreateGroup}
          >
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('groups.create')}</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center py-12">
          <div className="text-destructive">{t('groups.loadError')}</div>
        </div>
      )}

      {/* Groups Grid */}
      {!isLoading && !isError && (
        <>
          <div
            data-testid="groups-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6"
          >
            {groups.map((group) => (
              <GroupCard
                key={group.groupUUID}
                group={group}
                onView={() => handleViewGroup(group)}
                onDelete={() => handleDeleteGroup(group)}
              />
            ))}
          </div>

          <GridPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={ITEMS_PER_PAGE}
            isFetching={isFetching}
            onPageChange={handlePageChange}
          />

          {groups.length === 0 && (
            <EmptyState
              icon={<FolderOpen className="h-10 w-10" />}
              title={t('groups.noGroups')}
              className="py-12"
            />
          )}
        </>
      )}

      {/* Sheets */}
      <GroupViewSheet
        group={selectedGroup}
        open={isViewSheetOpen}
        onOpenChange={setIsViewSheetOpen}
      />

      <GroupCreateSheet
        group={null}
        open={isCreateSheetOpen}
        onOpenChange={setIsCreateSheetOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!groupToDelete}
        onOpenChange={(open) => !open && setGroupToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('groups.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('groups.deleteConfirmDescription', {
                name: groupToDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full gap-2">
            <AlertDialogCancel className="flex-1">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white flex-1"
              onClick={handleConfirmDeleteGroup}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
