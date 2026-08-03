'use client'

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Preferences, UserDTO } from 'io2p-client'

import { useAuth } from '@/contexts/auth-context'
import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import {
  PREFERENCES,
  type PreferenceKey,
  type PreferenceValues,
} from '@/constants'

/**
 * Read + write one account preference, stored on the node.
 *
 * Previously a per-browser `localStorage` blob, which made a preference a
 * property of the machine rather than of the account: a view set on a laptop
 * was not the view you got on a phone, and the onboarding seen-flag was shared
 * by everyone who logged into the same computer.
 *
 * The read is free — `users.me()` already runs during auth and carries
 * `preferences` with it, so this reads out of that cache rather than issuing
 * anything. The write is a MERGE patch of the single key that changed, which is
 * what lets two devices edit two different preferences concurrently without one
 * clobbering the other.
 */

/** Validated stored value for `key`, else the hardcoded default. */
function resolve<K extends PreferenceKey>(
  preferences: Preferences | undefined,
  key: K
): PreferenceValues[K] {
  const spec = PREFERENCES[key]
  const stored = (
    preferences?.[spec.ns] as Record<string, unknown> | undefined
  )?.[key]
  return spec.validate(stored) ? stored : spec.default
}

/**
 * Returns `[value, setValue, resolved]` — `useState` plus a readiness flag.
 *
 * `resolved` matters because preferences arrive with `/me`. A caller that
 * renders the default meanwhile shows the WRONG view and then swaps — a visible
 * flip on every cold load. Wait on `resolved` and you get one loading state
 * instead. It follows `authLoading`, so a logged-out or failed auth still
 * resolves (to the defaults) rather than waiting forever.
 */
export function usePreference<K extends PreferenceKey>(
  key: K
): [PreferenceValues[K], (value: PreferenceValues[K]) => void, boolean] {
  const { preferences, authLoading } = useAuth()
  const iom = useIomClient()
  const queryClient = useQueryClient()

  const value = useMemo(() => resolve(preferences, key), [preferences, key])

  const { mutate } = useMutation({
    mutationFn: (next: PreferenceValues[K]) =>
      iom.users.updatePreferences({ [PREFERENCES[key].ns]: { [key]: next } }),
    // A view toggle must flip on click, not a round trip later, so patch the
    // cached user up front and let the response confirm it.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.current })
      const previous = queryClient.getQueryData<UserDTO>(
        queryKeys.users.current
      )
      queryClient.setQueryData<UserDTO>(queryKeys.users.current, (user) => {
        if (!user) return user
        const ns = PREFERENCES[key].ns
        const preferences: Preferences = {
          ...user.preferences,
          [ns]: { ...user.preferences?.[ns], [key]: next },
        }
        return { ...user, preferences }
      })
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.users.current, context.previous)
      }
    },
    // The node returns the FULL merged bag, so trust it over the optimistic
    // guess — another device may have changed a different key meanwhile.
    onSuccess: (merged) => {
      queryClient.setQueryData<UserDTO>(queryKeys.users.current, (user) =>
        user ? { ...user, preferences: merged } : user
      )
    },
  })

  const setValue = useCallback(
    (next: PreferenceValues[K]) => mutate(next),
    [mutate]
  )

  return [value, setValue, !authLoading]
}

// Test surface.
export { resolve }
