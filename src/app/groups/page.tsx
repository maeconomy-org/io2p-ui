'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { GroupCreateDTO } from 'iom-sdk'
import { Search, Loader2, X, PlusCircle } from 'lucide-react'

import { logger } from '@/lib'
import { Button, Input } from '@/components/ui'
import { FacetedFilter } from '@/components/filters'
import {
  GroupCard,
  GroupViewSheet,
  GroupCreateSheet,
  useGroupFilters,
} from '@/components/groups'
import { useAuth } from '@/contexts'
import { useGroups } from '@/hooks/api'

type GroupFilter = 'all' | 'my' | 'shared'

export default function GroupsPage() {
  const t = useTranslations()
  const { userUUID } = useAuth()
  const { useListGroups } = useGroups()
  const { data: groups, isLoading, isError } = useListGroups()

  const [selectedGroup, setSelectedGroup] = useState<GroupCreateDTO | null>(
    null
  )
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  const {
    searchTerm,
    currentPage,
    activeFilter,
    paginatedGroups,
    totalPages,
    startIndex,
    filteredGroups,
    handleSearchChange,
    handleFilterChange,
    handlePageChange,
  } = useGroupFilters({
    groups,
    userUUID,
    itemsPerPage: 12,
  })

  const handleViewGroup = (group: GroupCreateDTO) => {
    setSelectedGroup(group)
    setIsViewSheetOpen(true)
  }

  const handleCreateGroup = () => {
    setIsCreateSheetOpen(true)
  }

  const handleDeleteGroup = useCallback(
    (group: GroupCreateDTO) => {
      logger.info('Deleting group:', { uuid: group.groupUUID })
      if (confirm(t('groups.confirmDelete', { name: group.name }))) {
        logger.info('Group deleted (soft delete)')
      }
    },
    [t]
  )

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold shrink-0">{t('groups.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
          {/* Search */}
          <div className="relative w-56" data-testid="group-search-container">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              data-testid="group-search-input"
              placeholder={t('groups.search')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-7 h-9 text-sm"
            />
            {searchTerm && (
              <button
                data-testid="group-search-clear-button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Quick filter dropdown */}
          <FacetedFilter
            title={t('groups.filter.label')}
            options={[
              { value: 'all', label: t('groups.filter.all') },
              { value: 'my', label: t('groups.filter.my') },
              { value: 'shared', label: t('groups.filter.shared') },
            ]}
            selected={activeFilter === 'all' ? [] : [activeFilter]}
            onSelectionChange={(values) =>
              handleFilterChange((values[0] as GroupFilter) || 'all')
            }
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
            {paginatedGroups.map((group) => (
              <GroupCard
                key={group.groupUUID}
                group={group}
                onView={() => handleViewGroup(group)}
                onDelete={() => handleDeleteGroup(group)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t('groups.showing', {
                  start: startIndex + 1,
                  end: Math.min(startIndex + 12, filteredGroups.length),
                  total: filteredGroups.length,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  {t('common.previous')}
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {filteredGroups.length === 0 && (
            <div data-testid="no-groups-message" className="text-center py-12">
              <div className="text-muted-foreground">
                {searchTerm ? t('groups.noMatches') : t('groups.noGroups')}
              </div>
            </div>
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
    </div>
  )
}
