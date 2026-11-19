'use client'

import { useQuery } from '@tanstack/react-query'

import { authClient } from '@/lib/auth/client'
import { queryKeys } from '@/lib/query-keys'

/** What io2p-auth lets this login page offer (GET /api/auth/sign-in-options). */
export interface SignInOptions {
  providers: string[]
  signUp: 'off' | 'directory' | 'open'
  approval: 'none' | 'admin'
}

// Fail closed: no answer means no social buttons, never buttons that 400.
const NONE: SignInOptions = { providers: [], signUp: 'off', approval: 'none' }

export function useSignInOptions() {
  const query = useQuery({
    queryKey: queryKeys.auth.signInOptions,
    queryFn: async ({ signal }): Promise<SignInOptions> => {
      const { data, error } = await authClient.$fetch<SignInOptions>(
        '/sign-in-options',
        { method: 'GET', signal }
      )
      if (error || !data) return NONE
      return {
        providers: Array.isArray(data.providers) ? data.providers : [],
        signUp: data.signUp ?? 'off',
        approval: data.approval ?? 'none',
      }
    },
    staleTime: 60_000,
    retry: false,
  })
  return query.data ?? NONE
}
