'use client'

import { useObjects } from '@/hooks/api/entities'

/**
 * Resolve a flow's `ref` (an object id) to that object's name.
 *
 * Only for TEMPLATE flows. A process flow arrives with `refName` already populated — io2p resolves
 * it server-side in one batched lookup per page — but `TemplateDTO`'s flow shape has no `refName`
 * field at all, so a template flow carries a bare uuid and the row would print it.
 *
 * One read per distinct ref, under the shared `objects.detail` key: opening that object afterwards
 * is a cache hit, and two flows pointing at the same object share the entry. `enrichFiles: false`
 * because a name is all this needs.
 *
 * Worth an eventual backend ask — the same `enrichRefNames` the processes list gained would apply
 * here — at which point this hook and its callers can go.
 */
export function useRefName(ref: string | undefined, known: string | undefined) {
  const needsLookup = !!ref && !known
  const { data } = useObjects().useGet(needsLookup ? ref : undefined, {
    enrichFiles: false,
  })

  // Falls back to the raw id rather than to nothing: an unresolved ref is still a real target, and
  // blanking it would read as "no object selected".
  return known ?? data?.name ?? ref
}
