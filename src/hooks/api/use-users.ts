import { useQuery } from '@tanstack/react-query'

import { useIomSdkClient } from '@/contexts'
import { queryKeys } from '@/lib/query-keys'

export function useUsers() {
  const client = useIomSdkClient()

  const useCurrentUser = () =>
    useQuery({
      queryKey: queryKeys.users.current,
      queryFn: ({ signal }) => client.user.getCurrentUser({ signal }),
      staleTime: 5 * 60 * 1000,
    })

  const useFindUserByIdentifier = (
    identifier: string,
    options: { enabled?: boolean } = {}
  ) => {
    const trimmed = identifier.trim()
    return useQuery({
      queryKey: queryKeys.users.findByIdentifier(trimmed),
      queryFn: ({ signal }) =>
        client.user.findByIdentifier(trimmed, { signal }),
      enabled: (options.enabled ?? true) && trimmed.length > 0,
      staleTime: 30 * 1000,
      gcTime: 60 * 1000,
    })
  }

  return { useCurrentUser, useFindUserByIdentifier }
}
