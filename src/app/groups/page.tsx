'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search } from 'lucide-react'

import { logger } from '@/lib'
import { Button, Input, DeletedFilter } from '@/components/ui'
import {
  GroupCard,
  GroupViewSheet,
  GroupCreateEditSheet,
  dummyGroups,
} from '@/components/groups'

export default function GroupsPage() {
  const t = useTranslations()
  const [groups] = useState(dummyGroups)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<
    (typeof dummyGroups)[0] | null
  >(null)
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false)
  const [isCreateEditSheetOpen, setIsCreateEditSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<
    (typeof dummyGroups)[0] | null
  >(null)

  const itemsPerPage = 12

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDeleted = showDeleted ? true : !group.isDeleted

    return matchesSearch && matchesDeleted
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedGroups = filteredGroups.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  // Reset to first page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleViewGroup = (group: (typeof dummyGroups)[0]) => {
    setSelectedGroup(group)
    setIsViewSheetOpen(true)
  }

  const handleEditGroup = (group: (typeof dummyGroups)[0]) => {
    setEditingGroup(group)
    setIsCreateEditSheetOpen(true)
  }

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setIsCreateEditSheetOpen(true)
  }

  const handleDeleteGroup = (group: (typeof dummyGroups)[0]) => {
    // In real implementation, this would call the delete API
    logger.info('Deleting group:', { uuid: group.uuid })
    // For now, just show a confirmation
    if (confirm(t('groups.confirmDelete', { name: group.name }))) {
      logger.info('Group deleted (soft delete)')
    }
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('groups.title')}</h1>
        <div className="flex items-center gap-2">
          {/* Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearchInput(!showSearchInput)}
            className="h-8 w-8 p-0"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Filter Button */}
          <DeletedFilter
            showDeleted={showDeleted}
            onShowDeletedChange={setShowDeleted}
            label={t('groups.showDeleted')}
          />

          <Button
            onClick={handleCreateGroup}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('groups.create')}
          </Button>
        </div>
      </div>

      {/* Search Input (conditionally shown) */}
      {showSearchInput && (
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('groups.search')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">{filteredGroups.length}</div>
          <div className="text-sm text-muted-foreground">
            {searchTerm || showDeleted
              ? t('groups.filtered')
              : t('groups.total')}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.filter((g) => g.type === 'public').length}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('groups.public')}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.filter((g) => g.type === 'private').length}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('groups.private')}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.reduce((sum, g) => sum + g.objectCount, 0)}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('groups.totalObjects')}
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {paginatedGroups.map((group) => (
          <GroupCard
            key={group.uuid}
            group={group}
            onView={() => handleViewGroup(group)}
            onEdit={() => handleEditGroup(group)}
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
              end: Math.min(startIndex + itemsPerPage, filteredGroups.length),
              total: filteredGroups.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
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
              onClick={() => setCurrentPage(currentPage + 1)}
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

      {/* Sheets */}
      <GroupViewSheet
        group={selectedGroup}
        open={isViewSheetOpen}
        onOpenChange={setIsViewSheetOpen}
        onEdit={() => {
          if (selectedGroup) {
            handleEditGroup(selectedGroup)
            setIsViewSheetOpen(false)
          }
        }}
      />

      <GroupCreateEditSheet
        group={editingGroup}
        open={isCreateEditSheetOpen}
        onOpenChange={setIsCreateEditSheetOpen}
      />
    </div>
  )
}
