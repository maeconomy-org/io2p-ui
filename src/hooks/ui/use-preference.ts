'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import { useAuth } from '@/contexts/auth-context'
import {
  PREFERENCES_ROOT,
  PREFERENCES_VERSION,
  VIEW_PREFERENCES,
  type ViewPreferenceKey,
  type ViewPreferenceValues,
} from '@/constants'

/**
 * Account-scoped UI preferences persisted in `localStorage`.
 *
 * Clones the `useSyncExternalStore` idiom from `use-object-drafts.ts`: a single
 * versioned blob per `userId`, a module-level listener set for same-tab sync,
 * a `storage`-event subscription for cross-tab sync, silent-fail `try/catch`,
 * and an SSR-safe server snapshot. All view preferences share one blob, so a
 * single read/write covers them and a future settings page edits the same
 * object with no refactor.
 */

type PreferenceBlob = Partial<ViewPreferenceValues>

const keyFor = (uuid: string) =>
  `${PREFERENCES_ROOT}:${PREFERENCES_VERSION}:${uuid}`

function readBlob(uuid: string): PreferenceBlob {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(keyFor(uuid))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as PreferenceBlob)
      : {}
  } catch {
    return {}
  }
}

function isAllowed<K extends ViewPreferenceKey>(
  key: K,
  value: unknown
): value is ViewPreferenceValues[K] {
  return (VIEW_PREFERENCES[key].allowed as readonly unknown[]).includes(value)
}

/** Validated stored value for `key`, else the hardcoded default. */
function resolve<K extends ViewPreferenceKey>(
  uuid: string | undefined,
  key: K
): ViewPreferenceValues[K] {
  const fallback = VIEW_PREFERENCES[key].default
  if (!uuid) return fallback
  const stored = readBlob(uuid)[key]
  return isAllowed(key, stored) ? stored : fallback
}

function writePreference<K extends ViewPreferenceKey>(
  uuid: string,
  key: K,
  value: ViewPreferenceValues[K]
) {
  try {
    const next = { ...readBlob(uuid), [key]: value }
    localStorage.setItem(keyFor(uuid), JSON.stringify(next))
    notify()
  } catch {
    // silent fail
  }
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}

function subscribeFactory(uuid: string | undefined) {
  return (listener: () => void) => {
    listeners.add(listener)
    const key = uuid ? keyFor(uuid) : null
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }
}

function getSnapshotFactory(uuid: string | undefined) {
  return () => {
    if (typeof window === 'undefined' || !uuid) return ''
    // `localStorage` access itself can throw (private mode / blocked storage);
    // returning '' falls back to defaults instead of crashing the render.
    try {
      return localStorage.getItem(keyFor(uuid)) ?? ''
    } catch {
      return ''
    }
  }
}

function getServerSnapshot(): string {
  return ''
}

/**
 * Read + write one account-scoped view preference. Returns `[value, setValue]`
 * like `useState`. `value` is the validated stored value or the hardcoded
 * default. Until `userId` resolves (auth init / logged out) it returns the
 * default and `setValue` is a no-op — we never persist without an account.
 */
export function usePreference<K extends ViewPreferenceKey>(
  key: K
): [ViewPreferenceValues[K], (value: ViewPreferenceValues[K]) => void] {
  const { userId } = useAuth()

  // Recreate subscribe/getSnapshot only when the account changes — the raw
  // snapshot must keep a stable string identity (parsing happens below).
  const subscribe = useMemo(() => subscribeFactory(userId), [userId])
  const getSnapshot = useMemo(() => getSnapshotFactory(userId), [userId])

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const value = useMemo<ViewPreferenceValues[K]>(() => {
    const fallback = VIEW_PREFERENCES[key].default
    if (!userId || !raw) return fallback
    try {
      const parsed = JSON.parse(raw) as PreferenceBlob
      const stored = parsed?.[key]
      return isAllowed(key, stored) ? stored : fallback
    } catch {
      return fallback
    }
  }, [raw, key, userId])

  const setValue = useCallback(
    (next: ViewPreferenceValues[K]) => {
      if (!userId) return
      writePreference(userId, key, next)
    },
    [userId, key]
  )

  return [value, setValue]
}

// Test surface + non-hook escape hatch for callers without a React context.
export { keyFor, readBlob, resolve, writePreference }
