'use client'

import { useQuery } from '@tanstack/react-query'

import { authClient } from '@/lib/auth/client'
import { queryKeys } from '@/lib/query-keys'

export interface LinkedAccount {
  id: string
  providerId: string
  createdAt: string | Date
}

export function useLinkedAccounts() {
  return useQuery({
    queryKey: queryKeys.auth.accounts,
    // Without the signal the fetch outlives the unmount — switching settings tabs
    // tears this query down mid-flight and better-fetch reports the cancellation
    // as a bare `TypeError: Failed to fetch`, indistinguishable from a real one.
    queryFn: async ({ signal }): Promise<LinkedAccount[]> => {
      const { data, error } = await authClient.listAccounts({
        fetchOptions: { signal },
      })
      if (error) {
        throw new Error(error.message)
      }
      return (data ?? []) as LinkedAccount[]
    },
  })
}
