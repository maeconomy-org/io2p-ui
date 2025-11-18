'use client'

import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'

import { Button, Input, DeletedFilter } from '@/components/ui'
import {
  GroupCard,
  GroupViewSheet,
  GroupCreateEditSheet,
  dummyGroups,
} from '@/components/groups'

export default function GroupsPage() {
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
    console.log('Deleting group:', group.uuid)
    // For now, just show a confirmation
    if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
      console.log('Group deleted (soft delete)')
    }
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Groups & Projects</h1>
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
            label="Show deleted groups"
          />

          <Button
            onClick={handleCreateGroup}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Search Input (conditionally shown) */}
      {showSearchInput && (
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search groups..."
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
            {searchTerm || showDeleted ? 'Filtered Groups' : 'Total Groups'}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.filter((g) => g.type === 'public').length}
          </div>
          <div className="text-sm text-muted-foreground">Public Groups</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.filter((g) => g.type === 'private').length}
          </div>
          <div className="text-sm text-muted-foreground">Private Groups</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="text-2xl font-bold">
            {filteredGroups.reduce((sum, g) => sum + g.objectCount, 0)}
          </div>
          <div className="text-sm text-muted-foreground">Total Objects</div>
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
            Showing {startIndex + 1}-
            {Math.min(startIndex + itemsPerPage, filteredGroups.length)} of{' '}
            {filteredGroups.length} groups
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
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
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm
              ? 'No groups found matching your search.'
              : 'No groups available.'}
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
