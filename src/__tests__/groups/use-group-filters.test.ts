import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGroupFilters } from '@/components/groups/hooks/use-group-filters'
import type {
  GroupCreateDTO,
  GroupPermission,
  PageImplGroupFullDTO,
} from 'iom-sdk'

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

// Helper to build a PageImpl response from a content array
function createMockPage(
  content: GroupCreateDTO[],
  overrides?: Partial<PageImplGroupFullDTO>
): PageImplGroupFullDTO {
  return {
    content,
    totalPages: 3,
    totalElements: 30,
    size: content.length,
    number: 0,
    numberOfElements: content.length,
    first: true,
    last: false,
    empty: content.length === 0,
    pageable: {
      paged: true,
      pageNumber: 0,
      pageSize: content.length,
      offset: 0,
      sort: { sorted: false, empty: true, unsorted: true },
      unpaged: false,
    },
    sort: { sorted: false, empty: true, unsorted: true },
    ...overrides,
  }
}

describe('useGroupFilters', () => {
  it('should return filtered groups excluding defaults', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({ page, userUUID: MOCK_USER_UUID })
    )

    // 5 groups - 1 default = 4
    expect(result.current.filteredGroups).toHaveLength(4)
    expect(result.current.filteredGroups.some((g) => g.default)).toBe(false)
  })

  it('should return totalPages and totalElements from server', () => {
    const page = createMockPage(MOCK_GROUPS, {
      totalPages: 5,
      totalElements: 50,
    })
    const { result } = renderHook(() =>
      useGroupFilters({ page, userUUID: MOCK_USER_UUID })
    )

    expect(result.current.totalPages).toBe(5)
    expect(result.current.totalElements).toBe(50)
  })

  it('should handle undefined page', () => {
    const { result } = renderHook(() =>
      useGroupFilters({ page: undefined, userUUID: MOCK_USER_UUID })
    )

    expect(result.current.filteredGroups).toEqual([])
    expect(result.current.totalPages).toBe(0)
    expect(result.current.totalElements).toBe(0)
  })

  it('should filter by search term', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        searchTerm: 'First',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(1)
    expect(result.current.filteredGroups[0].name).toBe('My First Group')
  })

  it('should be case-insensitive when searching', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        searchTerm: 'SHARED',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every((g) =>
        g.name.toLowerCase().includes('shared')
      )
    ).toBe(true)
  })

  it('should filter by "my" groups (owned by user)', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        activeFilter: 'my',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every(
        (g) => g.ownerUserUUID === MOCK_USER_UUID
      )
    ).toBe(true)
  })

  it('should filter by "shared" groups (not owned by user)', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        activeFilter: 'shared',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(2)
    expect(
      result.current.filteredGroups.every(
        (g) => g.ownerUserUUID !== MOCK_USER_UUID
      )
    ).toBe(true)
  })

  it('should exclude default groups from all filters', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        activeFilter: 'all',
      })
    )

    expect(result.current.filteredGroups.some((g) => g.default)).toBe(false)
  })

  it('should combine search and filter', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        activeFilter: 'my',
        searchTerm: 'Second',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(1)
    expect(result.current.filteredGroups[0].name).toBe('My Second Group')
  })

  it('should handle empty search results', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: MOCK_USER_UUID,
        searchTerm: 'nonexistent',
      })
    )

    expect(result.current.filteredGroups).toHaveLength(0)
  })

  it('should handle undefined userUUID', () => {
    const page = createMockPage(MOCK_GROUPS)
    const { result } = renderHook(() =>
      useGroupFilters({
        page,
        userUUID: undefined,
        activeFilter: 'my',
      })
    )

    // When userUUID is undefined, "my" filter should exclude all
    expect(result.current.filteredGroups).toHaveLength(0)
  })

  it('should handle empty page content', () => {
    const page = createMockPage([], {
      totalPages: 0,
      totalElements: 0,
      empty: true,
    })
    const { result } = renderHook(() =>
      useGroupFilters({ page, userUUID: MOCK_USER_UUID })
    )

    expect(result.current.filteredGroups).toEqual([])
    expect(result.current.totalPages).toBe(0)
    expect(result.current.totalElements).toBe(0)
  })
})
