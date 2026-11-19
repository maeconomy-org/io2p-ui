'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Preferences, UserDTO } from 'io2p-client'

import {
  PREF_NS,
  SAVED_SEARCH_LIMITS,
  SAVED_SEARCH_PREFIX,
} from '@/constants/preferences'
import { useAuth } from '@/contexts/auth-context'
import { applyPatch } from '@/hooks/ui/use-preference'
import { useIomClient } from '@/lib/io2p'
import { iomDetail, iomStatus, isNodeUnreachable } from '@/lib/io2p-errors'
import { queryKeys } from '@/lib/query-keys'

export interface SavedSearch {
  key: string
  name: string
  query: string
  createdAt: number
}

/** Why a save or a delete did not happen. Each code has a `savedSearch.reason.*` text. */
export type SavedSearchReason =
  | { code: 'notReady' }
  /** A save or delete is still running: the caller ignores this one. */
  | { code: 'busy' }
  | { code: 'name' }
  | { code: 'emptyQuery' }
  | { code: 'queryTooLong' }
  | { code: 'duplicate'; name: string }
  | { code: 'full' }
  | { code: 'tooBig' }
  | { code: 'offline' }
  | { code: 'refused'; detail?: string }
  | { code: 'failed' }

export type SavedSearchResult =
  { ok: true } | { ok: false; reason: SavedSearchReason }

const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length

/**
 * The tokenizer reads `a  b` as `a b`, and the node matches without case, so a duplicate is the same
 * text with runs of spaces folded and case ignored.
 */
const foldQuery = (query: string) =>
  query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export const sameQuery = (a: string, b: string) => foldQuery(a) === foldQuery(b)

/** Code points, not UTF-16 units: a cut never splits a surrogate pair. */
export const nameLength = (name: string) => Array.from(name).length
export const cutName = (name: string) =>
  Array.from(name.trim()).slice(0, SAVED_SEARCH_LIMITS.nameChars).join('')

function isSavedSearch(value: unknown): value is Omit<SavedSearch, 'key'> {
  if (typeof value !== 'object' || value === null) return false
  const { name, query, createdAt } = value as Record<string, unknown>
  return (
    typeof name === 'string' &&
    name.trim() !== '' &&
    typeof query === 'string' &&
    query.trim() !== '' &&
    typeof createdAt === 'number' &&
    Number.isFinite(createdAt)
  )
}

const searchBag = (preferences: Preferences | undefined) =>
  (preferences?.[PREF_NS.search] ?? {}) as Record<string, unknown>

/**
 * The saved searches, newest first. An `s-` entry of another shape is UNREADABLE: it is listed
 * apart so the user can delete it, because it still uses the node's budget.
 */
export function readSavedSearches(preferences: Preferences | undefined): {
  saved: SavedSearch[]
  unreadable: string[]
} {
  const saved: SavedSearch[] = []
  const unreadable: string[] = []
  for (const [key, value] of Object.entries(searchBag(preferences))) {
    if (!key.startsWith(SAVED_SEARCH_PREFIX)) continue
    if (isSavedSearch(value)) {
      saved.push({
        key,
        name: value.name,
        query: value.query,
        createdAt: value.createdAt,
      })
    } else unreadable.push(key)
  }
  saved.sort((a, b) => b.createdAt - a.createdAt || (a.key < b.key ? -1 : 1))
  unreadable.sort()
  return { saved, unreadable }
}

/**
 * The reason a save must not be sent, or null. The count is every `s-` key, unreadable ones too.
 * The total measures the WHOLE raw `search` bag after the patch, other keys too, because the node
 * counts them.
 * Saving again under a key that is already stored (a retry after a timeout that landed) is the
 * same write, so it is not a duplicate and adds nothing to the count.
 */
export function checkSave(
  preferences: Preferences | undefined,
  key: string,
  name: string,
  query: string
): SavedSearchReason | null {
  const trimmedName = name.trim()
  if (
    trimmedName === '' ||
    nameLength(trimmedName) > SAVED_SEARCH_LIMITS.nameChars
  ) {
    return { code: 'name' }
  }
  const trimmedQuery = query.trim()
  if (trimmedQuery === '') return { code: 'emptyQuery' }
  // `- 2`: the quotes JSON puts around a string are not the user's text.
  if (jsonBytes(trimmedQuery) - 2 > SAVED_SEARCH_LIMITS.queryBytes) {
    return { code: 'queryTooLong' }
  }
  const { saved } = readSavedSearches(preferences)
  const twin = saved.find((s) => s.key !== key && sameQuery(s.query, query))
  if (twin) return { code: 'duplicate', name: twin.name }

  const bag = searchBag(preferences)
  const isNew = !(key in bag)
  const stored = Object.keys(bag).filter((k) =>
    k.startsWith(SAVED_SEARCH_PREFIX)
  ).length
  if (isNew && stored >= SAVED_SEARCH_LIMITS.count) return { code: 'full' }

  const after = applyPatch(
    preferences,
    savePatch(key, trimmedName, trimmedQuery, Date.now())
  )
  if (jsonBytes(after[PREF_NS.search]) > SAVED_SEARCH_LIMITS.totalBytes) {
    return { code: 'tooBig' }
  }
  return null
}

const savePatch = (
  key: string,
  name: string,
  query: string,
  createdAt: number
): Preferences => ({ [PREF_NS.search]: { [key]: { name, query, createdAt } } })

export function reasonOf(error: unknown): SavedSearchReason {
  if (isNodeUnreachable(error)) return { code: 'offline' }
  const status = iomStatus(error)
  if (status === 400 || status === 422) {
    return { code: 'refused', detail: iomDetail(error) }
  }
  return { code: 'failed' }
}

/**
 * Saved searches, kept in the account's preferences.
 *
 * Save and delete are NOT optimistic, unlike `usePreference`: a saved search is something the user
 * must be able to trust, so the row appears only once the node has it, and a refusal says why.
 * Both run in one mutation scope, so a save and a delete reach the node in the order they were made.
 */
export function useSavedSearches() {
  const iom = useIomClient()
  const queryClient = useQueryClient()
  const { preferences, authLoading, isAuthenticated } = useAuth()
  const ready = isAuthenticated && !authLoading && !!preferences
  const { saved, unreadable } = useMemo(
    () => readSavedSearches(preferences),
    [preferences]
  )

  const { mutateAsync, isPending } = useMutation({
    scope: { id: 'saved-searches' },
    // The default 'online' mode pauses the write while the browser is offline: the dialog stays on
    // "Saving…" and the save lands later, unasked. 'always' sends it, so the user sees "offline".
    networkMode: 'always',
    mutationFn: (patch: Preferences) => iom.users.updatePreferences(patch),
    // Only OUR patch goes into the cache, never the node's whole bag: with an optimistic theme
    // toggle in flight, an older full bag landing last would put the old theme back.
    onSuccess: (_merged, patch) => {
      queryClient.setQueryData<UserDTO>(queryKeys.users.current, (user) =>
        user
          ? { ...user, preferences: applyPatch(user.preferences, patch) }
          : user
      )
    },
    // A `/me` already in flight answers with the bag from BEFORE this write; refetch after it.
    // On an error too: a timed-out write may have landed.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.current })
    },
  })

  // `isPending` reaches the next render, not the next keypress: a second Enter in the same frame
  // must find the first one still running.
  const inFlight = useRef(false)
  const send = useCallback(
    async (patch: Preferences): Promise<SavedSearchResult> => {
      if (inFlight.current) return { ok: false, reason: { code: 'busy' } }
      inFlight.current = true
      try {
        await mutateAsync(patch)
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      } finally {
        inFlight.current = false
      }
    },
    [mutateAsync]
  )

  /**
   * `key` comes from the caller and stays the same for every retry of one save, so a write that
   * timed out after it landed is written again, not saved twice.
   */
  const save = useCallback(
    (key: string, name: string, query: string): Promise<SavedSearchResult> => {
      if (!ready) {
        return Promise.resolve({ ok: false, reason: { code: 'notReady' } })
      }
      const refused = checkSave(preferences, key, name, query)
      if (refused) return Promise.resolve({ ok: false, reason: refused })
      return send(savePatch(key, name.trim(), query.trim(), Date.now()))
    },
    [ready, preferences, send]
  )

  const remove = useCallback(
    (key: string): Promise<SavedSearchResult> => {
      if (!ready) {
        return Promise.resolve({ ok: false, reason: { code: 'notReady' } })
      }
      return send({ [PREF_NS.search]: { [key]: null } } as Preferences)
    },
    [ready, send]
  )

  return { ready, saved, unreadable, save, remove, pending: isPending }
}
