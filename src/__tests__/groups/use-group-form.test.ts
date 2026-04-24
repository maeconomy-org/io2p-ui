import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGroupForm } from '@/components/groups/hooks/use-group-form'
import type { GroupPermission, UserDTO } from 'iom-sdk'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'groups.cannotAddOwner': 'Cannot add owner',
      'groups.userAlreadyExists': 'User already added',
    }
    return translations[key] || key
  },
}))

function makeUser(uuid: string, extras: Partial<UserDTO> = {}): UserDTO {
  return {
    userUUID: uuid,
    createdAt: '2026-01-01T00:00:00.000Z',
    identifier: extras.identifier ?? `user-${uuid}@example.com`,
    identifierType: extras.identifierType ?? 'UserAuthUP',
    ...extras,
  }
}

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

    act(() => {
      result.current.handleAddPendingUser(makeUser('user-123'))
      result.current.setIsPublic(true)
    })

    expect(result.current.pendingUsers).toHaveLength(1)
    expect(result.current.isPublic).toBe(true)

    rerender({ open: false })
    rerender({ open: true })

    expect(result.current.pendingUsers).toHaveLength(0)
    expect(result.current.isPublic).toBe(false)
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
  })

  it('should clear add user error', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.setAddUserError('Some error')
    })

    act(() => {
      result.current.clearUserError()
    })

    expect(result.current.addUserError).toBeNull()
  })

  it('should toggle public state', () => {
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
    expect(result.current.publicPermissions).toEqual([
      'READ' as GroupPermission,
    ])

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

    act(() => {
      result.current.handleAddPendingUser(makeUser('user-123'))
    })

    expect(result.current.pendingUsers).toHaveLength(1)
    expect(result.current.pendingUsers[0].userUUID).toBe('user-123')
    expect(result.current.pendingUsers[0].permissions).toContain(
      'READ' as GroupPermission
    )

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

    act(() => {
      result.current.handleAddPendingUser(makeUser('user-123'))
    })

    act(() => {
      result.current.clearUserError()
    })

    act(() => {
      result.current.handleAddPendingUser(makeUser('user-123'))
    })

    expect(result.current.addUserError).toBe('User already added')
    expect(result.current.pendingUsers).toHaveLength(1)
  })

  it('should refuse to add the owner', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        ownerUserUUID: 'owner-uuid',
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.handleAddPendingUser(makeUser('owner-uuid'))
    })

    expect(result.current.addUserError).toBe('Cannot add owner')
    expect(result.current.pendingUsers).toHaveLength(0)
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
    expect(dto.usersShare).toBeUndefined()
  })

  it('should reset form manually', () => {
    const { result } = renderHook(() =>
      useGroupForm({
        open: true,
        onClose: mockOnClose,
      })
    )

    act(() => {
      result.current.handleAddPendingUser(makeUser('user-123'))
      result.current.setIsPublic(true)
      result.current.setAddUserError('Some error')
    })

    act(() => {
      result.current.resetForm()
    })

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
