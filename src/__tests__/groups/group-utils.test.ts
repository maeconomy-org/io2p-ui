import { describe, it, expect } from 'vitest'
import type {
  GroupCreateDTO,
  GroupPermission,
  GroupShareToUserDTO,
} from 'iom-sdk'

import {
  hasPermission,
  canEditGroup,
  canEditRecords,
  formatPermissions,
  deduplicateUsersShare,
  getEffectivePermissions,
  canUserWriteRecords,
  canUserEditGroup,
} from '@/components/groups/utils/group-utils'

const READ = 'READ' as GroupPermission
const GROUP_WRITE = 'GROUP_WRITE' as GroupPermission
const GROUP_WRITE_RECORDS = 'GROUP_WRITE_RECORDS' as GroupPermission

function group(overrides: Partial<GroupCreateDTO> = {}): GroupCreateDTO {
  return {
    name: 'Test',
    ownerUserUUID: 'owner-1',
    usersShare: [],
    ...overrides,
  } as GroupCreateDTO
}

function share(
  userUUID: string,
  permissions: GroupPermission[]
): GroupShareToUserDTO {
  return { userUUID, permissions } as GroupShareToUserDTO
}

describe('group-utils', () => {
  describe('hasPermission', () => {
    it('returns true when the permission is present', () => {
      expect(hasPermission([READ, GROUP_WRITE], GROUP_WRITE)).toBe(true)
    })

    it('returns false when the permission is missing', () => {
      expect(hasPermission([READ], GROUP_WRITE)).toBe(false)
    })

    it('returns false for undefined permissions', () => {
      expect(hasPermission(undefined, READ)).toBe(false)
    })

    it('returns false for an empty array', () => {
      expect(hasPermission([], READ)).toBe(false)
    })
  })

  describe('canEditGroup / canEditRecords', () => {
    it('canEditGroup is true only when GROUP_WRITE is granted', () => {
      expect(canEditGroup([GROUP_WRITE])).toBe(true)
      expect(canEditGroup([READ])).toBe(false)
      expect(canEditGroup(undefined)).toBe(false)
    })

    it('canEditRecords is true only when GROUP_WRITE_RECORDS is granted', () => {
      expect(canEditRecords([GROUP_WRITE_RECORDS])).toBe(true)
      // GROUP_WRITE alone does NOT imply records — they are independent.
      expect(canEditRecords([GROUP_WRITE])).toBe(false)
    })
  })

  describe('formatPermissions', () => {
    it('joins multiple permissions with commas', () => {
      expect(formatPermissions([GROUP_WRITE, READ])).toBe('GROUP_WRITE, READ')
    })

    it('falls back to READ for empty/undefined input', () => {
      expect(formatPermissions([])).toBe('READ')
      expect(formatPermissions(undefined)).toBe('READ')
    })
  })

  describe('deduplicateUsersShare', () => {
    it('keeps the last occurrence for each userUUID', () => {
      const result = deduplicateUsersShare([
        share('u1', [READ]),
        share('u2', [READ]),
        share('u1', [GROUP_WRITE]),
      ])
      expect(result).toHaveLength(2)
      expect(result.find((s) => s.userUUID === 'u1')?.permissions).toEqual([
        GROUP_WRITE,
      ])
    })

    it('drops entries without a userUUID', () => {
      const result = deduplicateUsersShare([
        { permissions: [READ] } as GroupShareToUserDTO,
        share('u1', [READ]),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].userUUID).toBe('u1')
    })

    it('returns an empty array for an empty input', () => {
      expect(deduplicateUsersShare([])).toEqual([])
    })
  })

  describe('getEffectivePermissions', () => {
    it('returns none when userUUID is undefined', () => {
      const result = getEffectivePermissions(group(), undefined)
      expect(result).toEqual({
        permissions: [],
        isOwner: false,
        source: 'none',
      })
    })

    it('returns full access for the owner', () => {
      const result = getEffectivePermissions(group(), 'owner-1')
      expect(result.isOwner).toBe(true)
      expect(result.source).toBe('owner')
      expect(result.permissions).toEqual([GROUP_WRITE, GROUP_WRITE_RECORDS])
    })

    it('returns the user-specific share when present', () => {
      const g = group({ usersShare: [share('u1', [GROUP_WRITE])] })
      const result = getEffectivePermissions(g, 'u1')
      expect(result.source).toBe('user')
      expect(result.permissions).toEqual([GROUP_WRITE])
      expect(result.isOwner).toBe(false)
    })

    it('prefers user-specific rights over public rights', () => {
      const g = group({
        usersShare: [share('u1', [GROUP_WRITE])],
        publicShare: { permissions: [READ] } as GroupCreateDTO['publicShare'],
      })
      const result = getEffectivePermissions(g, 'u1')
      // User-specific should win even though the group is public.
      expect(result.source).toBe('user')
      expect(result.permissions).toEqual([GROUP_WRITE])
    })

    it('falls back to public rights for non-shared users on a public group', () => {
      const g = group({
        publicShare: { permissions: [READ] } as GroupCreateDTO['publicShare'],
      })
      const result = getEffectivePermissions(g, 'stranger')
      expect(result.source).toBe('public')
      expect(result.permissions).toEqual([READ])
    })

    it('treats a user-share with empty permissions as absent and falls through to public', () => {
      // Empty permissions on a usersShare entry means "no special rights" —
      // the public fallback should still apply.
      const g = group({
        usersShare: [share('u1', [])],
        publicShare: { permissions: [READ] } as GroupCreateDTO['publicShare'],
      })
      const result = getEffectivePermissions(g, 'u1')
      expect(result.source).toBe('public')
      expect(result.permissions).toEqual([READ])
    })

    it('returns none for a private group with no matching share', () => {
      const result = getEffectivePermissions(group(), 'stranger')
      expect(result).toEqual({
        permissions: [],
        isOwner: false,
        source: 'none',
      })
    })
  })

  describe('canUserWriteRecords / canUserEditGroup', () => {
    it('owner can do both', () => {
      const g = group()
      expect(canUserWriteRecords(g, 'owner-1')).toBe(true)
      expect(canUserEditGroup(g, 'owner-1')).toBe(true)
    })

    it('user with only GROUP_WRITE_RECORDS cannot edit settings', () => {
      const g = group({ usersShare: [share('u1', [GROUP_WRITE_RECORDS])] })
      expect(canUserWriteRecords(g, 'u1')).toBe(true)
      expect(canUserEditGroup(g, 'u1')).toBe(false)
    })

    it('user with only GROUP_WRITE cannot write records', () => {
      const g = group({ usersShare: [share('u1', [GROUP_WRITE])] })
      expect(canUserWriteRecords(g, 'u1')).toBe(false)
      expect(canUserEditGroup(g, 'u1')).toBe(true)
    })

    it('public READ-only group: stranger can do neither', () => {
      const g = group({
        publicShare: { permissions: [READ] } as GroupCreateDTO['publicShare'],
      })
      expect(canUserWriteRecords(g, 'stranger')).toBe(false)
      expect(canUserEditGroup(g, 'stranger')).toBe(false)
    })
  })
})
