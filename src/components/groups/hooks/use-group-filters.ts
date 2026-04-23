'use client'

import { useMemo } from 'react'
import type { GroupCreateDTO, PageImplGroupFullDTO } from 'iom-sdk'

type GroupFilter = 'all' | 'my' | 'shared'

interface UseGroupFiltersOptions {
  page: PageImplGroupFullDTO | undefined
  userUUID: string | undefined
  activeFilter?: GroupFilter
}

interface UseGroupFiltersReturn {
  filteredGroups: GroupCreateDTO[]
  totalPages: number
  totalElements: number
}

export function useGroupFilters(
  options: UseGroupFiltersOptions
): UseGroupFiltersReturn {
  const { page, userUUID, activeFilter = 'all' } = options

  // Client-side owner filter on the current page content
  const filteredGroups = useMemo(() => {
    if (!page?.content) return []
    return page.content.filter((group) => {
      if (group.default) return false

      if (activeFilter === 'my' && group.ownerUserUUID !== userUUID)
        return false
      if (activeFilter === 'shared' && group.ownerUserUUID === userUUID)
        return false

      return true
    })
  }, [page?.content, activeFilter, userUUID])

  // Total pages and elements come from the server response
  const totalPages = page?.totalPages ?? 0
  const totalElements = page?.totalElements ?? 0

  return {
    filteredGroups,
    totalPages,
    totalElements,
  }
}
