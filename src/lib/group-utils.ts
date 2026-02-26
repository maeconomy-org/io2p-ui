import type { GroupPermission, GroupShareToUserDTO } from 'iom-sdk'

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
