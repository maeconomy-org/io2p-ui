'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Preferences, UserDTO } from 'io2p-client'

import { useAuth } from '@/contexts/auth-context'
import { usePreferenceHints } from '@/contexts/preference-hints-context'
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

/**
 * Validated stored value for `key`, else `fallback`.
 *
 * `fallback` is the cookie hint rather than the hardcoded default, so a value
 * the node has not answered for yet holds the hint continuously. Falling back to
 * the default instead would flip twice on every cold load: hint, default, real.
 */
function resolve<K extends PreferenceKey>(
  preferences: Preferences | undefined,
  key: K,
  fallback: PreferenceValues[K] = PREFERENCES[key].default
): PreferenceValues[K] {
  const spec = PREFERENCES[key]
  const stored = (
    preferences?.[spec.ns] as Record<string, unknown> | undefined
  )?.[spec.key ?? key]
  return spec.validate(stored) ? stored : fallback
}

/** Validated flag read — a flag is set only when the stored value is `true`. */
function resolveFlag(
  preferences: Preferences | undefined,
  ns: string,
  key: string
): boolean {
  return (
    (preferences?.[ns] as Record<string, unknown> | undefined)?.[key] === true
  )
}

const emptySubscribe = () => () => {}

/**
 * `true` once hydrated, and `false` during SSR and the hydrating render.
 *
 * A distinct server snapshot is what keeps the first client render identical to
 * the server's. Same trick the navbar uses to decide ⌘ vs Ctrl.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

/** Two-level merge, `null` deletes — mirrors what the node does server-side. */
function applyPatch(
  current: Preferences | undefined,
  patch: Preferences
): Preferences {
  const next: Preferences = { ...current }
  for (const [ns, bag] of Object.entries(patch)) {
    const merged = { ...next[ns] }
    for (const [key, value] of Object.entries(bag)) {
      if (value === null) delete merged[key]
      else merged[key] = value
    }
    next[ns] = merged
  }
  return next
}

/**
 * The WRITE half of the preference layer: optimistic apply, rollback on error,
 * the server's merged bag wins on success.
 *
 * Takes an arbitrary merge patch so the typed hooks above and below it share one
 * mutation rather than each carrying a copy of this three-way dance.
 */
function usePreferencePatch(): (patch: Preferences) => void {
  const iom = useIomClient()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  const { mutate } = useMutation({
    mutationFn: (patch: Preferences) => iom.users.updatePreferences(patch),
    // A toggle must flip on click, not a round trip later, so patch the cached
    // user up front and let the response confirm it.
    // NOT `cancelQueries` first, which is the usual optimistic-update recipe. The query it would
    // cancel is `/me` — the one whose cached user this very update needs. On a COLD load `/me` is
    // still in flight when the click lands, so cancelling it means `getQueryData` returns
    // undefined, the callback below returns `user` untouched, nothing re-renders, and the control
    // snaps back to the cookie hint. The PATCH still succeeds: the server has the new value and the
    // screen says otherwise, so the user clicks again. Observed as an aborted `/me` beside a 200
    // on `/me/preferences`.
    //
    // The race `cancelQueries` exists to prevent — an in-flight `/me` resolving afterwards and
    // overwriting the optimistic value — is handled by re-applying the patch in `onSettled`
    // instead, which costs nothing when the cache was warm.
    onMutate: (patch) => {
      const previous = queryClient.getQueryData<UserDTO>(
        queryKeys.users.current
      )
      queryClient.setQueryData<UserDTO>(queryKeys.users.current, (user) =>
        user
          ? { ...user, preferences: applyPatch(user.preferences, patch) }
          : user
      )
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.users.current, context.previous)
      }
    },
    // The node returns the FULL merged bag, so trust it over the optimistic
    // guess — another device may have changed a different key meanwhile.
    //
    // `user` can still be undefined here when `/me` has not landed yet, and dropping the write in
    // that case would discard the one authoritative answer we have. Re-apply it when `/me` arrives
    // instead: `onSettled` refetches, and the refetch carries the same value the server just
    // confirmed, so the two agree by construction.
    onSuccess: (merged) => {
      queryClient.setQueryData<UserDTO>(queryKeys.users.current, (user) =>
        user ? { ...user, preferences: merged } : user
      )
    },
    // Covers the cold-load case the removed `cancelQueries` used to (badly): an `/me` that was
    // already in flight resolves with the value from BEFORE this patch and would overwrite it.
    // Invalidating makes it refetch once the write has settled, so the cache converges on what the
    // server actually stores. A no-op when `/me` was already resolved and fresh.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.current })
    },
  })

  /**
   * Signed OUT, the write is SKIPPED rather than attempted and rolled back.
   *
   * The auth pages carry a theme and language control of their own, and there is no account yet to
   * store the choice on — the cookie the caller writes is what the server reads for the next
   * render, so the change still takes effect. Attempting it anyway 401s on every click, silently
   * (`onError` only restores the cache), which is a failing request per keystroke for nothing.
   */
  return useCallback(
    (patch: Preferences) => {
      if (!isAuthenticated) return
      mutate(patch)
    },
    [isAuthenticated, mutate]
  )
}

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
 *
 * It stays even though the cookie hint now makes both sides agree by
 * construction. It is what pins the hydrating render to the hint when React
 * Query already holds `/me` from an earlier mount — without it the design would
 * rest on "the cache is definitely cold", which is true today and one refactor
 * from being false.
 */
export function usePreference<K extends PreferenceKey>(
  key: K
): [PreferenceValues[K], (value: PreferenceValues[K]) => void, boolean] {
  const { preferences, authLoading } = useAuth()
  const hints = usePreferenceHints()
  const hydrated = useHydrated()
  const patch = usePreferencePatch()

  const seed = (hints[key as keyof typeof hints] ??
    PREFERENCES[key].default) as PreferenceValues[K]
  const stored = useMemo(
    () => resolve(preferences, key, seed),
    [preferences, key, seed]
  )
  // The seed until hydration, so the first client render matches the server.
  const value = hydrated ? stored : seed

  const setValue = useCallback(
    (next: PreferenceValues[K]) => {
      const { ns, key: storageKey } = PREFERENCES[key]
      patch({ [ns]: { [storageKey ?? key]: next } })
    },
    [patch, key]
  )

  // `!!preferences` and not just `!authLoading`: a re-created `/me` observer reports settled one
  // commit before its data lands, and a key with no cookie hint reads as its hardcoded default in
  // that gap. `onboarding.toursSeen` is the one that matters — an empty list means "never seen".
  return [value, setValue, hydrated && !authLoading && !!preferences]
}

/**
 * One boolean flag under an open key, for a family the registry cannot name
 * ahead of time — one key per concept hint, rather than one array holding them
 * all.
 *
 * Seven hints means seven independent writers, and the node merges PER KEY: with
 * an array, two tabs opening two different hints would race and one would lose.
 * Seven keys cannot.
 *
 * The setter takes NO argument. A flag is a one-way latch, so there is no API by
 * which a caller can clear one by accident.
 */
export function useFlagPreference(
  ns: string,
  key: string
): [boolean, () => void, boolean] {
  const { preferences, authLoading } = useAuth()
  const hydrated = useHydrated()
  const patch = usePreferencePatch()

  const stored = resolveFlag(preferences, ns, key)
  // Never set until hydrated, so the server render and the first client render
  // agree — a flag is not in the cookie, so the server cannot know it.
  const value = hydrated ? stored : false

  const mark = useCallback(
    () => patch({ [ns]: { [key]: true } }),
    [patch, ns, key]
  )

  return [value, mark, hydrated && !authLoading]
}

// Test surface.
export { resolve, resolveFlag, applyPatch }
