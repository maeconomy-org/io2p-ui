'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Loader2, X } from 'lucide-react'
import type { GroupCreateDTO } from 'iom-sdk'

import { logger } from '@/lib'
import { Button, Input } from '@/components/ui'
import { FacetedFilter } from '@/components/filters'
import {
  GroupCard,
  GroupViewSheet,
  GroupCreateSheet,
} from '@/components/groups'
import { useGroups } from '@/hooks/api'
import { useAuth } from '@/contexts'

type GroupFilter = 'all' | 'my' | 'shared'

export default function GroupsPage() {
  const t = useTranslations()
  const { useListGroups } = useGroups()
  const { data: groups, isLoading, isError } = useListGroups()
  const { userUUID } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all')
  const [selectedGroup, setSelectedGroup] = useState<GroupCreateDTO | null>(
    null
  )
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  const itemsPerPage = 12

  const filteredGroups = useMemo(() => {
    if (!groups) return []
    return groups.filter((group) => {
      if (group.default) return false

      // Quick filter
      if (activeFilter === 'my' && group.ownerUserUUID !== userUUID)
        return false
      if (activeFilter === 'shared' && group.ownerUserUUID === userUUID)
        return false

      const matchesSearch = group.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [groups, searchTerm, activeFilter, userUUID])

  // Pagination logic
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedGroups = filteredGroups.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  // Reset to first page when search/filter changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilterChange = (filter: GroupFilter) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }

  const handleViewGroup = (group: GroupCreateDTO) => {
    setSelectedGroup(group)
    setIsViewSheetOpen(true)
  }

  const handleCreateGroup = () => {
    setIsCreateSheetOpen(true)
  }

  const handleDeleteGroup = (group: GroupCreateDTO) => {
    logger.info('Deleting group:', { uuid: group.groupUUID })
    if (confirm(t('groups.confirmDelete', { name: group.name }))) {
      logger.info('Group deleted (soft delete)')
    }
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header row: title + search + filter + create */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold shrink-0">{t('groups.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('groups.search')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-7 h-9 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Quick filter dropdown (like DeletedFilter on objects page) */}
          <FacetedFilter
            title={t('groups.filter.label')}
            options={[
              { value: 'all', label: t('groups.filter.all') },
              { value: 'my', label: t('groups.filter.my') },
              { value: 'shared', label: t('groups.filter.shared') },
            ]}
            selected={[activeFilter]}
            onSelectionChange={(values) =>
              handleFilterChange((values[0] as GroupFilter) || 'all')
            }
            showSearch={false}
            clearLabel={t('common.clearFilters')}
          />
          {/* Create */}
          <Button onClick={handleCreateGroup}>
            <Plus className="h-4 w-4 sm:mr-2" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
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
                  end: Math.min(
                    startIndex + itemsPerPage,
                    filteredGroups.length
                  ),
                  total: filteredGroups.length,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => prev - 1)}
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
                        onClick={() => setCurrentPage(page)}
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
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {filteredGroups.length === 0 && (
            <div className="text-center py-12">
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
