/**
 * What the signed-in user may do with an object or a process.
 *
 * The node returns its own verdict as `permission` on the entity — the union of every grant that
 * reaches the caller, most-permissive wins. This module is the one place that turns that string
 * into an answer, so the thresholds live here rather than at fifteen call sites.
 *
 * The rungs mirror io2p-core's route guards exactly (`objects/routes/crud.routes.ts`): GET needs
 * `read`, PATCH needs `write`, and soft-delete + restore need `admin` — delete is NOT a write.
 *
 * Objects and processes only. Formulas, constants and templates are shared read-only by
 * construction, so ownership answers the same question there — see `canWriteLibraryItem`.
 */

/** The node's permission ladder, weakest first. */
export type Permission = 'read' | 'write' | 'share' | 'admin'

const RANK: Record<Permission, number> = {
  read: 0,
  write: 1,
  share: 2,
  admin: 3,
}

/**
 * Absent means UNRESTRICTED, not restricted.
 *
 * A node that predates the field omits it, and a viewer looking at their own rows must not lose
 * every control because of a version skew — the same reasoning that makes an unresolved owner
 * writable in `canWriteLibraryItem`. The node is still the enforcer; this only decides what to
 * offer.
 */
function meets(
  permission: Permission | undefined,
  required: Permission
): boolean {
  if (!permission) return true
  return RANK[permission] >= RANK[required]
}

/** May the viewer change this entity? PATCH is guarded at `write`. */
export function canEdit(permission?: Permission): boolean {
  return meets(permission, 'write')
}

/** May the viewer share this entity onward? Reading the grant list needs `share`. */
export function canReshare(permission?: Permission): boolean {
  return meets(permission, 'share')
}

/** May the viewer soft-delete this entity? Guarded at `admin`, not `write`. */
export function canDelete(permission?: Permission): boolean {
  return meets(permission, 'admin')
}

/** May the viewer restore it? The same rung as delete — both are lifecycle events. */
export function canRestore(permission?: Permission): boolean {
  return meets(permission, 'admin')
}

/**
 * The permission an entity's author holds on it.
 *
 * Objects and processes have no separate owner — their author IS their owner (io2p-core,
 * `shared/entity.user-names.ts`), so `createdBy` identifies the owner and an owner is `admin`.
 * Lets a caller answer for its own rows before the node's field is populated.
 */
export function permissionOf(
  entity: { permission?: Permission; createdBy?: string },
  viewerId?: string
): Permission | undefined {
  if (entity.permission) return entity.permission
  if (viewerId && entity.createdBy === viewerId) return 'admin'
  return undefined
}

/**
 * The same answer, but `read` rather than "unrestricted" while the viewer is still unknown.
 *
 * `useAuth().userId` is undefined until BOTH the session and core's `/me` resolve, so for those
 * commits every row would fall through to the permissive default and flash a full menu on rows the
 * node refuses. Callers that render write affordances from a LIST should use this: a row carrying
 * its own `permission` is unaffected, and one relying on the owner fallback simply waits.
 */
export function permissionWhenKnown(
  entity: { permission?: Permission; createdBy?: string },
  viewerId: string | undefined,
  viewerLoading: boolean
): Permission | undefined {
  if (entity.permission) return entity.permission
  if (viewerLoading) return 'read'
  return permissionOf(entity, viewerId)
}
