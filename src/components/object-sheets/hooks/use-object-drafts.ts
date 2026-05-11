'use client'

import { useCallback, useSyncExternalStore } from 'react'

const INDEX_KEY = 'iom-drafts:objects:index'
const DRAFT_KEY_PREFIX = 'iom-drafts:objects:'
const MAX_DRAFTS = 25

export interface DraftIndexEntry {
  id: string
  updatedAt: number
  name: string
}

function readIndex(): DraftIndexEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DraftIndexEntry[]) : []
  } catch {
    return []
  }
}

function writeIndex(entries: DraftIndexEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
  } catch {
    // silent fail
  }
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === INDEX_KEY || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): string {
  return typeof window === 'undefined'
    ? '[]'
    : (localStorage.getItem(INDEX_KEY) ?? '[]')
}

function getServerSnapshot(): string {
  return '[]'
}

export function useObjectDrafts() {
  const indexRaw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const drafts: DraftIndexEntry[] = (() => {
    try {
      const parsed = JSON.parse(indexRaw)
      if (!Array.isArray(parsed)) return []
      return [...(parsed as DraftIndexEntry[])].sort(
        (a, b) => b.updatedAt - a.updatedAt
      )
    } catch {
      return []
    }
  })()

  const createDraftId = useCallback((): string => {
    const rand =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `draft_${rand}`
  }, [])

  const getDraft = useCallback(<T = unknown>(id: string): T | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`)
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }, [])

  const saveDraft = useCallback(
    (id: string, payload: unknown, name: string) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(
          `${DRAFT_KEY_PREFIX}${id}`,
          JSON.stringify(payload)
        )
        const current = readIndex().filter((e) => e.id !== id)
        const next: DraftIndexEntry[] = [
          { id, updatedAt: Date.now(), name },
          ...current,
        ]
        // Evict oldest beyond the cap
        if (next.length > MAX_DRAFTS) {
          const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
          const evicted = sorted.slice(MAX_DRAFTS)
          for (const e of evicted) {
            try {
              localStorage.removeItem(`${DRAFT_KEY_PREFIX}${e.id}`)
            } catch {
              // silent fail
            }
          }
          writeIndex(sorted.slice(0, MAX_DRAFTS))
        } else {
          writeIndex(next)
        }
        notify()
      } catch {
        // silent fail
      }
    },
    []
  )

  const deleteDraft = useCallback((id: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${id}`)
      writeIndex(readIndex().filter((e) => e.id !== id))
      notify()
    } catch {
      // silent fail
    }
  }, [])

  return {
    drafts,
    createDraftId,
    getDraft,
    saveDraft,
    deleteDraft,
  }
}

// Non-hook escape hatch — useful inside RHF watch callbacks where we don't
// want to re-subscribe components to the index but still need to read/write.
export const objectDraftsStore = {
  read: readIndex,
  get<T = unknown>(id: string): T | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  save(id: string, payload: unknown, name: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${id}`, JSON.stringify(payload))
      const current = readIndex().filter((e) => e.id !== id)
      const next: DraftIndexEntry[] = [
        { id, updatedAt: Date.now(), name },
        ...current,
      ]
      const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
      if (sorted.length > MAX_DRAFTS) {
        const evicted = sorted.slice(MAX_DRAFTS)
        for (const e of evicted) {
          try {
            localStorage.removeItem(`${DRAFT_KEY_PREFIX}${e.id}`)
          } catch {
            // silent fail
          }
        }
        writeIndex(sorted.slice(0, MAX_DRAFTS))
      } else {
        writeIndex(sorted)
      }
      notify()
    } catch {
      // silent fail
    }
  },
  delete(id: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${id}`)
      writeIndex(readIndex().filter((e) => e.id !== id))
      notify()
    } catch {
      // silent fail
    }
  },
  MAX_DRAFTS,
}

// Re-export used by tests
export { INDEX_KEY, DRAFT_KEY_PREFIX, MAX_DRAFTS }
