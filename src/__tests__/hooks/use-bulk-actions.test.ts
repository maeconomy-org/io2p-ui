import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBulkActions, BulkObject } from '@/hooks/ui/use-bulk-actions'
import { createTestWrapper } from '../helpers'

// Declare mock fns via vi.hoisted so they're available inside vi.mock factories
const {
  mockToastSuccess,
  mockToastError,
  mockSoftDeleteObject,
  mockCreateOrUpdateObject,
  mockAddGroupRecords,
  mockCreateGroup,
  mockCreateStatements,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSoftDeleteObject: vi.fn(),
  mockCreateOrUpdateObject: vi.fn(),
  mockAddGroupRecords: vi.fn(),
  mockCreateGroup: vi.fn(),
  mockCreateStatements: vi.fn(),
}))

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

// Mock SDK client
vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    node: {
      softDeleteObject: mockSoftDeleteObject,
      createOrUpdateObject: mockCreateOrUpdateObject,
      addGroupRecords: mockAddGroupRecords,
      createGroup: mockCreateGroup,
      createStatements: mockCreateStatements,
    },
  }),
}))

const MOCK_OBJECTS: BulkObject[] = [
  { uuid: 'uuid-1', name: 'Object 1' },
  { uuid: 'uuid-2', name: 'Object 2' },
  { uuid: 'uuid-3', name: 'Object 3' },
]

describe('useBulkActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Bulk Delete ----

  it('should bulk delete non-deleted objects and show success toast', async () => {
    mockSoftDeleteObject.mockResolvedValue({})
    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkDeleteMutation.mutate(MOCK_OBJECTS)
    })

    await waitFor(() =>
      expect(result.current.bulkDeleteMutation.isSuccess).toBe(true)
    )

    expect(mockSoftDeleteObject).toHaveBeenCalledTimes(3)
    expect(mockSoftDeleteObject).toHaveBeenCalledWith('uuid-1')
    expect(mockSoftDeleteObject).toHaveBeenCalledWith('uuid-2')
    expect(mockSoftDeleteObject).toHaveBeenCalledWith('uuid-3')
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it('should show error toast when bulk delete partially fails', async () => {
    mockSoftDeleteObject
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({})

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkDeleteMutation.mutate(MOCK_OBJECTS)
    })

    await waitFor(() =>
      expect(result.current.bulkDeleteMutation.isError).toBe(true)
    )

    expect(mockToastError).toHaveBeenCalled()
  })

  // ---- Bulk Restore ----

  it('should bulk restore soft-deleted objects and show success toast', async () => {
    mockCreateOrUpdateObject.mockResolvedValue({})
    const deletedObjects: BulkObject[] = [
      { uuid: 'uuid-1', name: 'Object 1', softDeleted: true },
      { uuid: 'uuid-2', name: 'Object 2', softDeleted: true },
    ]

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkRevertMutation.mutate(deletedObjects)
    })

    await waitFor(() =>
      expect(result.current.bulkRevertMutation.isSuccess).toBe(true)
    )

    expect(mockCreateOrUpdateObject).toHaveBeenCalledTimes(2)
    expect(mockCreateOrUpdateObject).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-1', name: 'Object 1' })
    )
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  // ---- Add to Group ----

  it('should add selected objects to an existing group', async () => {
    mockAddGroupRecords.mockResolvedValue({})

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkAddToGroupMutation.mutate({
        groupUUID: 'group-1',
        objectUUIDs: ['uuid-1', 'uuid-2'],
      })
    })

    await waitFor(() =>
      expect(result.current.bulkAddToGroupMutation.isSuccess).toBe(true)
    )

    expect(mockAddGroupRecords).toHaveBeenCalledWith('group-1', {
      recordUUIDs: ['uuid-1', 'uuid-2'],
    })
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  // ---- Create Group and Add ----

  it('should create a new group and add objects to it', async () => {
    mockCreateGroup.mockResolvedValue({ groupUUID: 'new-group-uuid' })
    mockAddGroupRecords.mockResolvedValue({})

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkCreateAndAddToGroupMutation.mutate({
        groupName: 'New Group',
        objectUUIDs: ['uuid-1', 'uuid-2'],
      })
    })

    await waitFor(() =>
      expect(result.current.bulkCreateAndAddToGroupMutation.isSuccess).toBe(
        true
      )
    )

    expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'New Group' })
    expect(mockAddGroupRecords).toHaveBeenCalledWith('new-group-uuid', {
      recordUUIDs: ['uuid-1', 'uuid-2'],
    })
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  // ---- Set Parent ----

  it('should set parent for selected objects via IS_PARENT_OF statements', async () => {
    mockCreateStatements.mockResolvedValue({})

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkSetParentMutation.mutate({
        parentUUID: 'parent-uuid',
        childUUIDs: ['uuid-1', 'uuid-2'],
      })
    })

    await waitFor(() =>
      expect(result.current.bulkSetParentMutation.isSuccess).toBe(true)
    )

    expect(mockCreateStatements).toHaveBeenCalledWith([
      {
        subject: 'parent-uuid',
        predicate: 'IS_PARENT_OF',
        object: 'uuid-1',
      },
      {
        subject: 'parent-uuid',
        predicate: 'IS_PARENT_OF',
        object: 'uuid-2',
      },
    ])
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it('should show error toast when set parent fails', async () => {
    mockCreateStatements.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useBulkActions(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      result.current.bulkSetParentMutation.mutate({
        parentUUID: 'parent-uuid',
        childUUIDs: ['uuid-1'],
      })
    })

    await waitFor(() =>
      expect(result.current.bulkSetParentMutation.isError).toBe(true)
    )

    expect(mockToastError).toHaveBeenCalled()
  })
})
