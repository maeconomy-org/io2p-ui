import type { SharedByMeItem } from 'io2p-client'

import { PERMISSION_TONES } from '@/components/ui/badge'

export type Permission = (typeof PERMISSION_TONES)[number]
type Subject = SharedByMeItem['grants'][number]['subject']

/** `PERMISSION_TONES` is already weakest-first, so its index IS the rank — one source, not two. */
const rankOf = (permission: string) =>
  PERMISSION_TONES.indexOf(permission as Permission)

/**
 * The strongest of a set, mirroring core's `strongestPermission`.
 *
 * io2p resolves effective access as the UNION across sources, most-permissive wins — so a person
 * holding `read` from one share and `write` from another can write. Showing either number alone
 * would be a lie about what they can do.
 */
export function strongest(permissions: string[]): Permission {
  return permissions.reduce<Permission>(
    (best, p) => (rankOf(p) > rankOf(best) ? (p as Permission) : best),
    'read'
  )
}

export interface PersonEntry {
  resource: SharedByMeItem['resource']
  /** Effective permission on THIS resource — the strongest across every source granting it. */
  permission: Permission
  /** True when any grant on this resource cascades to its descendants. */
  includeDescendants: boolean
}

export interface PersonAccess {
  /** `public`, or the node-local userId. */
  key: string
  subject: Subject
  /** Strongest permission held anywhere — the headline for the row. */
  highest: Permission
  entries: PersonEntry[]
}

const keyOf = (subject: Subject) =>
  subject.kind === 'public' ? 'public' : subject.userId

/**
 * Turn the shared-by-me rollup inside out: RESOURCE → grants becomes PERSON → resources.
 *
 * The rollup answers "what have I shared", which is not the question anyone asks first. "Who can
 * see my things, and what can they do" needs the other axis, and it cannot be read off the API
 * because a person's grants are scattered across one entry per resource — and, within a resource,
 * across one entry per SOURCE (an ad-hoc grant plus each Share covering it).
 *
 * So both levels collapse by taking the strongest: per resource, then overall.
 *
 * A DELETED resource is kept. The projection never joins the grant to the thing it points at, so a
 * share genuinely outlives its target — dropping those rows would under-report someone's reach.
 */
export function pivotByPerson(items: SharedByMeItem[]): PersonAccess[] {
  const byPerson = new Map<string, { subject: Subject; rows: PersonEntry[] }>()

  for (const item of items) {
    // Same subject twice on one resource means two SOURCES; they collapse to the strongest.
    const perSubject = new Map<string, PersonEntry>()

    for (const grant of item.grants) {
      const key = keyOf(grant.subject)
      const seen = perSubject.get(key)
      perSubject.set(key, {
        resource: item.resource,
        permission: seen
          ? strongest([seen.permission, grant.permission])
          : (grant.permission as Permission),
        includeDescendants:
          !!seen?.includeDescendants || !!grant.includeDescendants,
      })
    }

    for (const [key, entry] of perSubject) {
      const subject = item.grants.find((g) => keyOf(g.subject) === key)!.subject
      const person = byPerson.get(key) ?? { subject, rows: [] }
      person.rows.push(entry)
      byPerson.set(key, person)
    }
  }

  return (
    [...byPerson.entries()]
      .map(([key, { subject, rows }]) => ({
        key,
        subject,
        highest: strongest(rows.map((r) => r.permission)),
        entries: rows,
      }))
      // Widest reach first: the person to check is the one who can see the most.
      .sort(
        (a, b) =>
          rankOf(b.highest) - rankOf(a.highest) ||
          b.entries.length - a.entries.length
      )
  )
}
