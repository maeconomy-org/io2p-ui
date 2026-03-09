import type {
  GroupCreateDTO,
  GroupPermission,
  GroupShareToUserDTO,
} from 'iom-sdk'

/**
 * Check if user has a specific permission.
 */
export function hasPermission(
  permissions: GroupPermission[] | undefined,
  permission: GroupPermission
): boolean {
  return permissions?.includes(permission) ?? false
}

/**
 * Check if user can edit group settings (has GROUP_WRITE).
 */
export function canEditGroup(permissions?: GroupPermission[]): boolean {
  return hasPermission(permissions, 'GROUP_WRITE' as GroupPermission)
}

/**
 * Check if user can edit records (has GROUP_WRITE_RECORDS).
 */
export function canEditRecords(permissions?: GroupPermission[]): boolean {
  return hasPermission(permissions, 'GROUP_WRITE_RECORDS' as GroupPermission)
}

/**
 * Format permissions array for display (comma-separated).
 */
export function formatPermissions(permissions?: GroupPermission[]): string {
  if (!permissions || permissions.length === 0) return 'READ'
  return permissions.join(', ')
}

/**
 * Deduplicate usersShare array by userUUID.
 * Keeps the last occurrence for each userUUID (latest permissions win).
 */
export function deduplicateUsersShare(
  usersShare: GroupShareToUserDTO[]
): GroupShareToUserDTO[] {
  const map = new Map<string, GroupShareToUserDTO>()
  for (const entry of usersShare) {
    if (entry.userUUID) {
      map.set(entry.userUUID, entry)
    }
  }
  return Array.from(map.values())
}

/**
 * Resolve the effective permissions for a user in a group.
 *
 * Priority:
 * 1. Owner → full access (GROUP_WRITE + GROUP_WRITE_RECORDS)
 * 2. User-specific rights (usersShare entry) → use those if present
 * 3. Public group-level rights (publicShare.permissions) → fallback for public groups
 * 4. Empty → no special permissions
 */
export function getEffectivePermissions(
  group: GroupCreateDTO,
  userUUID: string | undefined
): {
  permissions: GroupPermission[]
  isOwner: boolean
  source: 'owner' | 'user' | 'public' | 'none'
} {
  if (!userUUID) {
    return { permissions: [], isOwner: false, source: 'none' }
  }

  // Owner gets full access
  if (userUUID === group.ownerUserUUID) {
    return {
      permissions: ['GROUP_WRITE', 'GROUP_WRITE_RECORDS'] as GroupPermission[],
      isOwner: true,
      source: 'owner',
    }
  }

  // Check for user-specific rights
  const usersShare = deduplicateUsersShare(group.usersShare ?? [])
  const userShare = usersShare.find((u) => u.userUUID === userUUID)
  if (userShare && userShare.permissions && userShare.permissions.length > 0) {
    return {
      permissions: userShare.permissions,
      isOwner: false,
      source: 'user',
    }
  }

  // Fallback to public group-level rights
  if (
    group.publicShare &&
    group.publicShare.permissions &&
    group.publicShare.permissions.length > 0
  ) {
    return {
      permissions: group.publicShare.permissions,
      isOwner: false,
      source: 'public',
    }
  }

  return { permissions: [], isOwner: false, source: 'none' }
}

/**
 * Check if a user can write records to a group.
 * Used for filtering groups in bulk add-to-group.
 */
export function canUserWriteRecords(
  group: GroupCreateDTO,
  userUUID: string | undefined
): boolean {
  const { permissions } = getEffectivePermissions(group, userUUID)
  return hasPermission(permissions, 'GROUP_WRITE_RECORDS' as GroupPermission)
}

/**
 * Check if a user can edit a group (write group settings).
 */
export function canUserEditGroup(
  group: GroupCreateDTO,
  userUUID: string | undefined
): boolean {
  const { permissions } = getEffectivePermissions(group, userUUID)
  return hasPermission(permissions, 'GROUP_WRITE' as GroupPermission)
}
