import type { UpdateShareBody } from 'io2p-client'

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

/**
 * The node's bundle caps, mirrored so the form can name what is wrong before the request does.
 *
 * io2p-core `lib/http/input-limits.ts`: `shareItems: 200`, `sharePairs: 500`. Mirrored, not
 * imported — the SDK does not publish them, and a wrong copy fails loudly here rather than
 * silently allowing a save the node refuses.
 */
const MAX_SHARE_ITEMS = 200
const MAX_SHARE_PAIRS = 500

export interface ShareCapRefusal {
  key: string
  values: Record<string, number>
}

/**
 * Too many resources or too many people, whichever is over first.
 *
 * Enforced at the schema, so it answers 400 with framework prose. That reads badly and is the
 * only thing the user would otherwise see — the bulk paths seed their resources pre-loaded, so
 * nothing else in the form has had a chance to say the set is too big.
 *
 * A WHOLE-BUNDLE write only. The edit request carries a delta, and the node caps each of its
 * arrays separately, so counting the resulting bundle here refused edits the node accepts — and
 * on a bundle already over the cap it refused every edit including the one that would bring it
 * back under.
 */
export function itemCapRefusal(
  resources: number,
  members: number
): ShareCapRefusal | null {
  if (resources > MAX_SHARE_ITEMS) {
    return {
      key: 'shares.caps.tooManyResources',
      values: { max: MAX_SHARE_ITEMS, count: resources },
    }
  }
  if (members > MAX_SHARE_ITEMS) {
    return {
      key: 'shares.caps.tooManyMembers',
      values: { max: MAX_SHARE_ITEMS, count: members },
    }
  }
  return null
}

/**
 * Which rule the node will apply to this save.
 *
 * Named for what the NODE writes, not for the sheet's mode: a duplicate posts a whole bundle
 * exactly as a create does, and reading UI modes here is how it would come to be missed.
 */
export type ShareWrite = 'bundle' | 'delta'

/**
 * Every cap that applies to this save, first one first.
 *
 * The PAIR cap applies to both writes. The node checks the resulting bundle on an edit exactly as
 * it does on a create — `shares.service.ts` calls the same `assertBundleConsistent` before it
 * computes any delta — so the two are one rule, not two.
 *
 * The ITEM cap applies to a whole-bundle write only. On an edit the node caps each DELTA array
 * (`resources.add`, `members.remove`, …) at 200 and never counts the resulting bundle, so a share
 * already holding 200 can legally be given a 201st: the request carries one item, not 201.
 */
export function shareCapRefusal(
  write: ShareWrite,
  resources: number,
  members: number,
  /** An edit's change lists, as the save sends them. */
  changes?: ShareChanges
): ShareCapRefusal | null {
  return (
    (write === 'bundle'
      ? itemCapRefusal(resources, members)
      : changeCapRefusal(changes)) ?? pairCapRefusal(resources, members)
  )
}

/** The lists an edit sends; each is capped on its own, not the bundle they add up to. */
// The edit body's own lists, so the cap cannot read a key the save no longer sends.
export type ShareChanges = Pick<UpdateShareBody, 'resources' | 'members'>

/**
 * An edit's cap: the node takes at most `shareItems` entries in EACH list it is sent (resources to
 * add, to remove; members to add, change, remove), and 400s a longer one with framework text.
 */
export function changeCapRefusal(
  changes: ShareChanges | undefined
): ShareCapRefusal | null {
  const lists = [
    changes?.resources?.add,
    changes?.resources?.remove,
    changes?.members?.add,
    changes?.members?.update,
    changes?.members?.remove,
  ]
  const count = Math.max(0, ...lists.map((list) => list?.length ?? 0))
  if (count <= MAX_SHARE_ITEMS) return null
  return {
    key: 'shares.caps.tooManyChanges',
    values: { max: MAX_SHARE_ITEMS, count },
  }
}

/**
 * Resources x members, against the RESULTING bundle — the node's rule on both writes
 * (`shares.rules.ts`, reached from create and from edit alike).
 *
 * An edit has a SECOND pair rule on top of this one, counting the grant writes the change makes
 * (revokes plus grants). That one is not mirrored: it is a function of a delta the node derives
 * from the stored bundle, so a client copy would drift the first time either side moved, and its
 * 422 already carries a detail naming the number.
 *
 * The product of two counts, never a sum: the form's own unsaved-changes bar shows
 * `resources + members`, so a message quoting one number beside a badge showing the other reads
 * as a broken counter. Every string here names its units.
 */
export function pairCapRefusal(
  resources: number,
  members: number
): ShareCapRefusal | null {
  const pairs = resources * members
  if (pairs <= MAX_SHARE_PAIRS) return null
  return {
    key: 'shares.caps.tooManyPairs',
    values: { max: MAX_SHARE_PAIRS, resources, members, pairs },
  }
}
