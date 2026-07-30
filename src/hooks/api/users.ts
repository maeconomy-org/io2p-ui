import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'

const DIRECTORY_QUERY = { page: 1, size: 200 } as const
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
    /** The page itself, for pickers that need to offer users rather than just name one. */
    users: data?.data ?? [],
    /** Display name, else email, else the raw id. Never empty. */
    nameOf: (userId: string) => {
      const user = byId.get(userId)
      return user?.displayName || user?.email || userId
    },
  }
}
