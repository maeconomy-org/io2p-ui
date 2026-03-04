import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGroupForm } from '@/components/groups/hooks/use-group-form'
import type { GroupPermission, GroupShareToUserDTO } from 'iom-sdk'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'groups.addUserError': 'Invalid UUID format',
      'groups.userAlreadyExists': 'User already added',
    }
    return translations[key] || key
  },
}))

// Mock iom-sdk
vi.mock('iom-sdk', () => ({
  validate: vi.fn((input: { uuid: string }) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(input.uuid)) {
      return { success: true, data: { uuid: input.uuid.toLowerCase() } }
    }
    return { success: false }
  }),
}))

describe('useGroupForm', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        defaultName: 'Test Group',
        onClose: mockOnClose,
      })
    )

    expect(result.current.form.getValues('name')).toBe('Test Group')
    expect(result.current.pendingUsers).toEqual([])
    expect(result.current.newUserUUID).toBe('')
    expect(result.current.newUserPermissions).toEqual([
      'READ' as GroupPermission,
    ])
    expect(result.current.addUserError).toBeNull()
    expect(result.current.isPublic).toBe(false)
    expect(result.current.publicPermissions).toEqual([
      'READ' as GroupPermission,
    ])
    expect(result.current.permissionOptions).toEqual([
      'READ' as GroupPermission,
      'GROUP_WRITE' as GroupPermission,
      'GROUP_WRITE_RECORDS' as GroupPermission,
    ])
  })

  it('should reset form when closed and reopened', () => {
    const { result, rerender } = renderHook(
      ({ open }) =>
        useGroupForm({
          open,
          defaultName: 'Test Group',
          onClose: mockOnClose,
        }),
      { initialProps: { open: true } }
    )

    // Change some values
    act(() => {
      result.current.setNewUserUUID('user-123')
      result.current.setIsPublic(true)
    })

    expect(result.current.newUserUUID).toBe('user-123')
    expect(result.current.isPublic).toBe(true)

    // Close sheet
    rerender({ open: false })

    // Reopen sheet
    rerender({ open: true })

    // Values should be reset
    expect(result.current.newUserUUID).toBe('')
    expect(result.current.isPublic).toBe(false)
  })

  it('should set new user UUID', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.setNewUserUUID('test-uuid-123')
    })

    expect(result.current.newUserUUID).toBe('test-uuid-123')
  })

  it('should set add user error', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.setAddUserError('Test error message')
    })

    expect(result.current.addUserError).toBe('Test error message')

    act(() => {
      result.current.clearUserError()
    })

    expect(result.current.addUserError).toBeNull()
  })

  it('should toggle permissions', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    // Initially has READ
    expect(result.current.newUserPermissions).toEqual([
      'READ' as GroupPermission,
    ])

    // Toggle GROUP_WRITE on
    act(() => {
      result.current.togglePermission('GROUP_WRITE' as GroupPermission)
    })

    expect(result.current.newUserPermissions).toContain(
      'GROUP_WRITE' as GroupPermission
    )

    // Toggle GROUP_WRITE off
    act(() => {
      result.current.togglePermission('GROUP_WRITE' as GroupPermission)
    })

    expect(result.current.newUserPermissions).not.toContain(
      'GROUP_WRITE' as GroupPermission
    )
  })

  it('should toggle public permissions', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    // Initially has READ
    expect(result.current.publicPermissions).toEqual([
      'READ' as GroupPermission,
    ])

    // Toggle GROUP_WRITE on
    act(() => {
      result.current.togglePublicPermission('GROUP_WRITE' as GroupPermission)
    })

    expect(result.current.publicPermissions).toContain(
      'GROUP_WRITE' as GroupPermission
    )
  })

  it('should set isPublic', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    expect(result.current.isPublic).toBe(false)

    act(() => {
      result.current.setIsPublic(true)
    })

    expect(result.current.isPublic).toBe(true)

    act(() => {
      result.current.setIsPublic(false)
    })

    expect(result.current.isPublic).toBe(false)
  })

  it('should add and remove pending users', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    // Add a user
    act(() => {
      result.current.setNewUserUUID('user-123')
    })

    act(() => {
      result.current.handleAddPendingUser()
    })

    expect(result.current.pendingUsers).toHaveLength(1)
    expect(result.current.pendingUsers[0].userUUID).toBe('user-123')
    expect(result.current.pendingUsers[0].permissions).toContain(
      'READ' as GroupPermission
    )

    // Remove the user
    act(() => {
      result.current.handleRemovePendingUser('user-123')
    })

    expect(result.current.pendingUsers).toHaveLength(0)
  })

  it('should show error when adding duplicate user', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    // Add a user first
    act(() => {
      result.current.setNewUserUUID('user-123')
    })
    act(() => {
      result.current.handleAddPendingUser()
    })

    // Clear error from first add
    act(() => {
      result.current.clearUserError()
    })

    // Try to add same user again
    act(() => {
      result.current.setNewUserUUID('user-123')
    })
    act(() => {
      result.current.handleAddPendingUser()
    })

    expect(result.current.addUserError).toBe('User already added')
  })

  it('should not add user with empty UUID', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.setNewUserUUID('')
      result.current.handleAddPendingUser()
    })

    // Empty UUID should not add any user
    expect(result.current.pendingUsers).toHaveLength(0)
    expect(result.current.addUserError).toBeNull()
  })

  it('should build group DTO without public share when private', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    const formData = { name: 'Private Group' }
    const dto = result.current.buildGroupDTO(formData)

    expect(dto.name).toBe('Private Group')
    expect(dto.publicShare).toBeUndefined()
    // When no pending users, usersShare is undefined (not included in DTO)
    expect(dto.usersShare).toBeUndefined()
  })

  it('should reset form manually', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    // Modify state
    act(() => {
      result.current.setNewUserUUID('user-123')
      result.current.setIsPublic(true)
      result.current.setAddUserError('Some error')
    })

    // Reset
    act(() => {
      result.current.resetForm()
    })

    expect(result.current.newUserUUID).toBe('')
    expect(result.current.isPublic).toBe(false)
    expect(result.current.addUserError).toBeNull()
    expect(result.current.pendingUsers).toHaveLength(0)
    expect(result.current.newUserPermissions).toEqual([
      'READ' as GroupPermission,
    ])
    expect(result.current.publicPermissions).toEqual([
      'READ' as GroupPermission,
    ])
  })
})
