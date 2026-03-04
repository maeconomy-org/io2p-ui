'use client'

import { useState, useMemo, useCallback } from 'react'
import type { GroupCreateDTO } from 'iom-sdk'

type GroupFilter = 'all' | 'my' | 'shared'

interface UseGroupFiltersOptions {
  groups: GroupCreateDTO[] | undefined
  userUUID: string | undefined
  itemsPerPage?: number
}

interface UseGroupFiltersReturn {
  searchTerm: string
  currentPage: number
  activeFilter: GroupFilter
  showDeleted: boolean
  filteredGroups: GroupCreateDTO[]
  paginatedGroups: GroupCreateDTO[]
  totalPages: number
  startIndex: number
  handleSearchChange: (value: string) => void
  handleFilterChange: (filter: GroupFilter) => void
  handlePageChange: (page: number) => void
  setShowDeleted: (show: boolean) => void
  resetFilters: () => void
}

export function useGroupFilters(
  options: UseGroupFiltersOptions
): UseGroupFiltersReturn {
  const { groups, userUUID, itemsPerPage = 12 } = options

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all')
  const [showDeleted, setShowDeleted] = useState(false)

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
  const totalPages = useMemo(
    () => Math.ceil(filteredGroups.length / itemsPerPage),
    [filteredGroups.length, itemsPerPage]
  )

  const startIndex = useMemo(
    () => (currentPage - 1) * itemsPerPage,
    [currentPage, itemsPerPage]
  )

  const paginatedGroups = useMemo(
    () => filteredGroups.slice(startIndex, startIndex + itemsPerPage),
    [filteredGroups, startIndex, itemsPerPage]
  )

  // Reset to first page when search/filter changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }, [])

  const handleFilterChange = useCallback((filter: GroupFilter) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const resetFilters = useCallback(() => {
    setSearchTerm('')
    setCurrentPage(1)
    setActiveFilter('all')
    setShowDeleted(false)
  }, [])

  return {
    searchTerm,
    currentPage,
    activeFilter,
    showDeleted,
    filteredGroups,
    paginatedGroups,
    totalPages,
    startIndex,
    handleSearchChange,
    handleFilterChange,
    handlePageChange,
    setShowDeleted,
    resetFilters,
  }
}
