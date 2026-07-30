'use client'

import { useMemo } from 'react'

import { useObjects, useProcesses } from '@/hooks/api/entities'

/**
 * The node's ceiling is 100; one page each is two requests for the whole page's labels.
 *
 * `deleted: 'include'` because a share OUTLIVES the thing it points at: `sharedByMe` reads the
 * access projection alone (`{grantedBy, active}`) and never joins to the resource, so a soft-deleted
 * object keeps its active grants and keeps appearing. Excluding deleted rows here made exactly those
 * rows fall back to a raw uuid — the resources most in need of a label.
 */
const DIRECTORY_QUERY = {
  page: 1,
  size: 100,
  scope: 'all' as const,
  deleted: 'include' as const,
}

/**
 * Names for bundled resources — TWO requests, not one per resource.
 *
 * A `ShareDTO` stores `{type, id}` with no names and the node has no bulk id lookup, so the obvious
 * implementation is a `get` per row. That is the N+1 that was deleted from the process graph, and it
 * is no better here for being inside a paginated list: ten rows is ten requests, and opening the
 * sheet again pays it again.
 *
 * Instead this mirrors `useUserDirectory` — one cached page per kind, shared through React Query by
 * every consumer on the page, resolving ids to labels in memory.
 *
 * The cost is the same as the user directory's: a resource outside the first page falls back to its
 * id. An unresolved ref should read as unresolved, never as absent. The real fix is a repeatable
 * `?id=` filter on the list reads (backend ask) — then this becomes an exact lookup instead of a
 * cached guess.
 */
export function useResourceDirectory(enabled: boolean) {
  const { data: objects } = useObjects().useList(DIRECTORY_QUERY, { enabled })
  const { data: processes } = useProcesses().useList(DIRECTORY_QUERY, {
    enabled,
  })

  const byId = useMemo(() => {
    const map = new Map<string, { name: string; deleted: boolean }>()
    for (const o of objects?.data ?? []) {
      map.set(`object:${o.id}`, { name: o.name, deleted: !!o.deleted })
    }
    for (const p of processes?.data ?? []) {
      map.set(`process:${p.id}`, { name: p.name, deleted: !!p.deleted })
    }
    return map
  }, [objects, processes])

  return {
    /**
     * The resource's name, or `null` when this page did not hold it.
     *
     * `type` is a plain string because callers pass the rollup's FIVE-type union: a formula or
     * template id simply misses, which is correct — this directory only knows objects and
     * processes, and a miss already falls back to the id.
     */
    nameOf: (type: string, id: string) =>
      byId.get(`${type}:${id}`)?.name ?? null,
    /** True when the shared resource has since been deleted — the share still points at it. */
    isDeleted: (type: string, id: string) =>
      byId.get(`${type}:${id}`)?.deleted ?? false,
  }
}
