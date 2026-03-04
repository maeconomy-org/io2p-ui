import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGroupFilters } from '@/components/groups/hooks/use-group-filters'
import type { GroupCreateDTO, GroupPermission } from 'iom-sdk'

// Mock group data for testing
const createMockGroup = (
  uuid: string,
  name: string,
  ownerUUID: string,
  publicShare: boolean,
  isDefault: boolean
): GroupCreateDTO => ({
  groupUUID: uuid,
  name,
  ownerUserUUID: ownerUUID,
  publicShare: publicShare
    ? { permissions: ['READ' as GroupPermission] }
    : undefined,
  default: isDefault,
})

const MOCK_USER_UUID = 'user-123'
const MOCK_GROUPS: GroupCreateDTO[] = [
  createMockGroup('group-1', 'My First Group', MOCK_USER_UUID, false, false),
  createMockGroup('group-2', 'My Second Group', MOCK_USER_UUID, true, false),
  createMockGroup('group-3', 'Shared Group', 'other-user', false, false),
  createMockGroup('group-4', 'Public Shared', 'other-user', true, false),
  createMockGroup('group-5', 'Default Group', MOCK_USER_UUID, false, true),
]

describe('useGroupFilters', () => {
  it('should return initial state correctly', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
        itemsPerPage: 2,
      })
    )

    expect(result.current.searchTerm).toBe('')
    expect(result.current.currentPage).toBe(1)
    expect(result.current.activeFilter).toBe('all')
    expect(result.current.showDeleted).toBe(false)
    expect(result.current.totalPages).toBe(2) // 4 non-default groups / 2 per page
  })

  it('should handle undefined groups', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: undefined,
        userUUID: MOCK_USER_UUID,
      })
    )

    expect(result.current.filteredGroups).toEqual([])
    expect(result.current.paginatedGroups).toEqual([])
    expect(result.current.totalPages).toBe(0)
  })

  it('should filter by search term', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    act(() => {
      result.current.handleSearchChange('First')
    })

    expect(result.current.searchTerm).toBe('First')
    expect(result.current.filteredGroups).toHaveLength(1)
    expect(result.current.filteredGroups[0].name).toBe('My First Group')
    expect(result.current.currentPage).toBe(1) // Resets to page 1
  })

  it('should be case-insensitive when searching', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    act(() => {
      result.current.handleSearchChange('SHARED')
    })

    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every((g) =>
        g.name.toLowerCase().includes('shared')
      )
    ).toBe(true)
  })

  it('should filter by "my" groups (owned by user)', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    act(() => {
      result.current.handleFilterChange('my')
    })

    expect(result.current.activeFilter).toBe('my')
    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every(
        (g) => g.ownerUserUUID === MOCK_USER_UUID
      )
    ).toBe(true)
  })

  it('should filter by "shared" groups (not owned by user)', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    act(() => {
      result.current.handleFilterChange('shared')
    })

    expect(result.current.activeFilter).toBe('shared')
    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every(
        (g) => g.ownerUserUUID !== MOCK_USER_UUID
      )
    ).toBe(true)
  })

  it('should exclude default groups from all filters', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    // Default group should never appear
    expect(result.current.filteredGroups.some((g) => g.default)).toBe(false)

    // Even with 'all' filter, default is excluded
    act(() => {
      result.current.handleFilterChange('all')
    })

    expect(result.current.filteredGroups.some((g) => g.default)).toBe(false)
  })

  it('should handle pagination correctly', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
        itemsPerPage: 2,
      })
    )

    expect(result.current.totalPages).toBe(2)
    expect(result.current.paginatedGroups).toHaveLength(2)
    expect(result.current.startIndex).toBe(0)

    // Go to page 2
    act(() => {
      result.current.handlePageChange(2)
    })

    expect(result.current.currentPage).toBe(2)
    expect(result.current.startIndex).toBe(2)
    expect(result.current.paginatedGroups).toHaveLength(2)
  })

  it('should reset to page 1 when search changes', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
        itemsPerPage: 2,
      })
    )

    // Go to page 2
    act(() => {
      result.current.handlePageChange(2)
    })

    expect(result.current.currentPage).toBe(2)

    // Search should reset to page 1
    act(() => {
      result.current.handleSearchChange('test')
    })

    expect(result.current.currentPage).toBe(1)
  })

  it('should reset to page 1 when filter changes', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
        itemsPerPage: 2,
      })
    )

    // Go to page 2
    act(() => {
      result.current.handlePageChange(2)
    })

    expect(result.current.currentPage).toBe(2)

    // Filter change should reset to page 1
    act(() => {
      result.current.handleFilterChange('my')
    })

    expect(result.current.currentPage).toBe(1)
  })

  it('should handle showDeleted toggle', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    expect(result.current.showDeleted).toBe(false)

    act(() => {
      result.current.setShowDeleted(true)
    })

    expect(result.current.showDeleted).toBe(true)
  })

  it('should reset all filters', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
        itemsPerPage: 2,
      })
    )

    // Change some filters
    act(() => {
      result.current.handleSearchChange('test')
      result.current.handleFilterChange('my')
      result.current.handlePageChange(2)
      result.current.setShowDeleted(true)
    })

    // Reset
    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.searchTerm).toBe('')
    expect(result.current.activeFilter).toBe('all')
    expect(result.current.currentPage).toBe(1)
    expect(result.current.showDeleted).toBe(false)
  })

  it('should combine search and filter', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    // Filter to "my" groups first
    act(() => {
      result.current.handleFilterChange('my')
    })

    expect(result.current.filteredGroups).toHaveLength(2)

    // Then search within those
    act(() => {
      result.current.handleSearchChange('Second')
    })

    expect(result.current.filteredGroups).toHaveLength(1)
    expect(result.current.filteredGroups[0].name).toBe('My Second Group')
  })

  it('should handle empty search results', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: MOCK_USER_UUID,
      })
    )

    act(() => {
      result.current.handleSearchChange('nonexistent')
    })

    expect(result.current.filteredGroups).toHaveLength(0)
    expect(result.current.totalPages).toBe(0)
    expect(result.current.paginatedGroups).toHaveLength(0)
  })

  it('should handle undefined userUUID', () => {
    const { result } = renderHook(() =>
      useGroupFilters({
        groups: MOCK_GROUPS,
        userUUID: undefined,
      })
    )

    // Should still work, just won't filter by ownership
    act(() => {
      result.current.handleFilterChange('my')
    })

    // When userUUID is undefined, "my" filter should exclude all (no matches)
    expect(result.current.filteredGroups).toHaveLength(0)
  })
})
