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
    queryFn: async (): Promise<LinkedAccount[]> => {
      const { data, error } = await authClient.listAccounts()
      if (error) {
        throw new Error(error.message)
      }
      return (data ?? []) as LinkedAccount[]
    },
  })
}
