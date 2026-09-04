import { useQuery } from '@tanstack/react-query'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { SEARCH_SIZE } from '@/constants'

// The user list changes far more slowly than the things it annotates.
const SEARCH_STALE_TIME = 10 * 60 * 1000

/**
 * Users matching a search, for pickers.
 *
 * The ONLY user read left. Names are resolved by the node on every read that references a user, so
 * nothing here turns an id into a label any more — this exists purely to let you FIND someone to
 * add, which needs to reach past any one page. `q` substring-matches displayName and email.
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
    queryFn: ({ signal }) => client.users.list(params, { signal }),
    enabled: options.enabled ?? true,
    staleTime: SEARCH_STALE_TIME,
    placeholderData: (previous) => previous,
  })

  return { users: data?.data ?? [], isFetching }
}
