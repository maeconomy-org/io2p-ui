import { useMutation } from '@tanstack/react-query'
import type { AggregateFindDTO } from 'iom-sdk'
import { useIomSdkClient } from '@/contexts'

export function useCommonApi() {
  const client = useIomSdkClient()

  // Check authentication status
  const useAuthCheck = () => {
    return useMutation({
      mutationFn: async (): Promise<{
        authenticated: boolean
        error?: string
      }> => {
        const isAuthenticated = client.isAuthenticated()
        if (!isAuthenticated) {
          throw new Error('Authentication required - user must login first')
        }
        return { authenticated: true }
      },
    })
  }

  // Search for objects by text or UUID with pagination support.
  // Defaults to the full readable scope so results include the user's own,
  // public, and shared groups — not only the default group. Callers can still
  // pass their own `accessFind` to override (e.g. to scope to a single group).
  const useSearch = () => {
    return useMutation({
      mutationFn: async (params: AggregateFindDTO) => {
        const response = await client.node.searchAggregates({
          accessFind: {
            readDefaultGroup: true,
            readOwnGroups: true,
            readPublicGroups: true,
            readUserSharedGroups: true,
          },
          ...params,
        })
        return response
      },
    })
  }

  return {
    useAuthCheck,
    useSearch,
  }
}
