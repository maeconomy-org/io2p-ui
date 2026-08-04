import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

// The node's ceiling — asking for more 400s the WHOLE request, costing every caller its names
// rather than just the overflow. Worth taking in full because every caller shares this ONE query
// key: it is one ~10 KB request per stale window for the whole session, not one per table. At 20 a
// name silently became a uuid on a node with 21 users, which is a failure that looks like data.
//
// User 101 is still a uuid. Fixing that needs batched name resolution on the reads themselves
// (`refNames` covers every referenced type EXCEPT users) — deferred until a node gets near this.
const DIRECTORY_QUERY = { page: 1, size: 100 } as const
const SEARCH_SIZE = 20
// The directory changes far more slowly than the objects it annotates.
const DIRECTORY_STALE_TIME = 10 * 60 * 1000

/**
 * Node users, indexed by id, for turning the raw `createdBy` / `deletedBy` on an entity into a name.
 *
 * The node offers no get-by-id, so this is one cached list shared by every caller. It resolves as
 * much as one page holds; anything beyond it falls back to the id rather than an empty label — an
 * unresolved author should look unresolved, not absent.
 */
export function useUserDirectory(options: { enabled?: boolean } = {}) {
  const client = useIomClient()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list(DIRECTORY_QUERY),
    queryFn: () => client.users.list(DIRECTORY_QUERY),
    enabled: options.enabled ?? true,
    staleTime: DIRECTORY_STALE_TIME,
  })

  const byId = useMemo(
    () => new Map((data?.data ?? []).map((u) => [u.id, u])),
    [data]
  )

  return {
    isLoading,
    /** Display name, else email, else the raw id. Never empty. */
    nameOf: (userId: string) => {
      const user = byId.get(userId)
      return user?.displayName || user?.email || userId
    },
  }
}

/**
 * Users matching a search, for pickers.
 *
 * Separate from the directory on purpose: the directory is a cached page used to NAME ids we
 * already have, and it stops at the node's 100-row ceiling. A picker has to be able to reach the
 * 101st user, so it asks the server (`q` substring-matches displayName and email) rather than
 * filtering a page that may not contain the answer.
 */
export function useUserSearch(
  query: string,
  options: { enabled?: boolean } = {}
) {
  const client = useIomClient()
  const trimmed = query.trim()
  const params = { page: 1, size: SEARCH_SIZE, q: trimmed || undefined }
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => client.users.list(params),
    enabled: options.enabled ?? true,
    staleTime: DIRECTORY_STALE_TIME,
    placeholderData: (previous) => previous,
  })

  return { users: data?.data ?? [], isFetching }
}
