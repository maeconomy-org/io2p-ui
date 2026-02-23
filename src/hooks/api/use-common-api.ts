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

  // Search for objects by text or UUID with pagination support
  const useSearch = () => {
    return useMutation({
      mutationFn: async (params: AggregateFindDTO) => {
        const response = await client.node.searchAggregates({
          ...params,
          readDefaultGroup: true,
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
