import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'iom-breadcrumb-trail'

export interface AncestorItem {
  uuid: string
  name: string
}

// ---------------------------------------------------------------------------
// Tiny external-store wrapper around localStorage so React re-renders on
// changes made in the same tab.
// ---------------------------------------------------------------------------
let listeners: Array<() => void> = []

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

function getServerSnapshot(): string {
  return '[]'
}

function writeTrail(trail: AncestorItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trail))
  } catch {
    /* quota exceeded – silently ignore */
  }
  emitChange()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the breadcrumb ancestor trail via localStorage.
 *
 * Instead of fetching every parent via the API, the trail is built
 * incrementally as the user navigates deeper into the hierarchy:
 *
 * - Call `pushAncestor({ uuid, name })` **before** navigating to a child.
 * - Call `navigateToAncestor(uuid)` when the user clicks a breadcrumb —
 *   this trims the trail to that ancestor (exclusive).
 * - Call `clearTrail()` when the user returns to the root objects page.
 *
 * The returned `ancestors` array is ordered root → immediate parent.
 */
export function useBreadcrumbTrail(currentUuid: string | undefined) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const parsed: AncestorItem[] = useMemo(() => {
    try {
      const arr: AncestorItem[] = JSON.parse(raw)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }, [raw])

  // Derive the visible ancestors — pure computation, no side-effects.
  // If the current page's UUID appears in the trail (e.g. after
  // pushAncestor on the same page, or browser-back), hide it and
  // everything after it from the displayed breadcrumb.
  const ancestors: AncestorItem[] = useMemo(() => {
    if (!currentUuid) return parsed
    const idx = parsed.findIndex((a) => a.uuid === currentUuid)
    if (idx !== -1) return parsed.slice(0, idx)
    return parsed
  }, [parsed, currentUuid])

  /** Push the current parent before navigating to a child. */
  const pushAncestor = useCallback((item: AncestorItem) => {
    const current: AncestorItem[] = JSON.parse(getSnapshot())
    // Avoid duplicates at the end
    if (current.length > 0 && current[current.length - 1].uuid === item.uuid)
      return
    writeTrail([...current, item])
  }, [])

  /** Trim the trail up to (but not including) the clicked ancestor. */
  const navigateToAncestor = useCallback((uuid: string) => {
    const current: AncestorItem[] = JSON.parse(getSnapshot())
    const idx = current.findIndex((a) => a.uuid === uuid)
    if (idx !== -1) {
      writeTrail(current.slice(0, idx))
    }
  }, [])

  /** Reset the trail (e.g. when going back to root). */
  const clearTrail = useCallback(() => {
    writeTrail([])
  }, [])

  return { ancestors, pushAncestor, navigateToAncestor, clearTrail }
}

/**
 * @deprecated Use `useBreadcrumbTrail` instead.
 * Kept for backward-compatibility — returns the same `ancestors` array
 * wrapped in a React-Query-like shape so existing call-sites keep working
 * until they are migrated.
 */
export function useAncestorChain(uuid: string | undefined) {
  const { ancestors } = useBreadcrumbTrail(uuid)
  return { data: ancestors, isLoading: false, isError: false }
}
