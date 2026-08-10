'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
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

const emptySubscribe = () => () => {}

/**
 * Returns `[value, setValue, resolved]` — `useState` plus a readiness flag.
 *
 * `resolved` matters because preferences arrive with `/me`. A caller that
 * renders the default meanwhile shows the WRONG view and then swaps — a visible
 * flip on every cold load. Wait on `resolved` and you get one loading state
 * instead. It follows `authLoading`, so a logged-out or failed auth still
 * resolves (to the defaults) rather than waiting forever.
 *
 * Both returns are HYDRATION-SAFE, and they have to be. A preference lives on
 * the node, so the server cannot know it: it renders the default and reports
 * `resolved: false`. The browser restores auth from localStorage synchronously,
 * so without this its very first render already had the stored value and
 * `resolved: true` — a guaranteed mismatch on every load of a page that reads
 * one. It showed up as "Hydration failed" on `/objects` and `/processes`, the
 * only two pages that gate on `resolved`, while pages that do not were clean.
 *
 * `useSyncExternalStore` with a distinct server snapshot is the fix: React uses
 * that snapshot for SSR *and* for the hydrating render, then re-renders with the
 * client value. Same trick the navbar uses to decide ⌘ vs Ctrl.
 */
export function usePreference<K extends PreferenceKey>(
  key: K
): [PreferenceValues[K], (value: PreferenceValues[K]) => void, boolean] {
  const { preferences, authLoading } = useAuth()
  const iom = useIomClient()
  const queryClient = useQueryClient()

  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const stored = useMemo(() => resolve(preferences, key), [preferences, key])
  // The default until hydration, so the first client render matches the server.
  const value = hydrated ? stored : PREFERENCES[key].default

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

  return [value, setValue, hydrated && !authLoading]
}

// Test surface.
export { resolve }
