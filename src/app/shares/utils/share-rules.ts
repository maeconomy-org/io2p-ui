import type { ShareResourceType } from '@/components/access'

/**
 * The two families a bundle may hold, and MAY NOT MIX.
 *
 * Library types are read-share only. A bundle spanning both families could therefore only exist at
 * `read`, and raising it later would 422 partway through expansion — leaving half its (member,
 * resource) pairs granted and half not. The node refuses the mixture outright rather than
 * half-applying it, so the editor has to refuse it too, visibly, before the request.
 */
export type ShareResourceFamily = 'data' | 'library'

export function familyOf(type: ShareResourceType): ShareResourceFamily {
  return type === 'object' || type === 'process' ? 'data' : 'library'
}

/** Null while the bundle is empty — the first pick is what decides. */
export function familyOfBundle(
  resources: { type: ShareResourceType }[]
): ShareResourceFamily | null {
  const first = resources[0]
  return first ? familyOf(first.type) : null
}

/**
 * Cascade is an ancestor walk at check time, so it means something only for a type that HAS
 * descendants. Objects, and nothing else — a bundle holding one process or one formula cannot
 * cascade at all, and an empty one has nothing to cascade over.
 */
export function canCascade(resources: { type: ShareResourceType }[]) {
  return resources.length > 0 && resources.every((r) => r.type === 'object')
}

/**
 * Pin a library bundle's members to `read` at the point of the WRITE.
 *
 * Disabling the control is not enough: someone can add a member at `write` and only then drop a
 * formula into the bundle, at which point the staged permission is one the node refuses. Correcting
 * it here means the rule holds however the form got into that state.
 */
export function pinPermissions<T extends { permission: string }>(
  members: T[],
  family: ShareResourceFamily | null
): T[] {
  if (family !== 'library') return members
  return members.map((m) =>
    m.permission === 'read' ? m : { ...m, permission: 'read' }
  )
}
