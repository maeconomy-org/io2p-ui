'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { useAuth } from '@/contexts/auth-context'

const ROOT = 'iom-drafts:objects'
const MAX_DRAFTS = 25

const indexKeyFor = (uuid: string) => `${ROOT}:${uuid}:index`
const draftKeyFor = (uuid: string, id: string) => `${ROOT}:${uuid}:${id}`

export interface DraftIndexEntry {
  id: string
  updatedAt: number
  name: string
}

function readIndex(uuid: string): DraftIndexEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(indexKeyFor(uuid))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DraftIndexEntry[]) : []
  } catch {
    return []
  }
}

function writeIndex(uuid: string, entries: DraftIndexEntry[]) {
  try {
    localStorage.setItem(indexKeyFor(uuid), JSON.stringify(entries))
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
    const key = uuid ? indexKeyFor(uuid) : null
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
    if (typeof window === 'undefined' || !uuid) return '[]'
    return localStorage.getItem(indexKeyFor(uuid)) ?? '[]'
  }
}

function getServerSnapshot(): string {
  return '[]'
}

export function useObjectDrafts() {
  const { userId } = useAuth()

  const indexRaw = useSyncExternalStore(
    subscribeFactory(userId),
    getSnapshotFactory(userId),
    getServerSnapshot
  )

  const drafts: DraftIndexEntry[] = (() => {
    if (!userId) return []
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

  const getDraft = useCallback(
    <T = unknown>(id: string): T | null => {
      if (typeof window === 'undefined' || !userId) return null
      try {
        const raw = localStorage.getItem(draftKeyFor(userId, id))
        if (!raw) return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },
    [userId]
  )

  const saveDraft = useCallback(
    (id: string, payload: unknown, name: string) => {
      if (typeof window === 'undefined' || !userId) return
      try {
        localStorage.setItem(draftKeyFor(userId, id), JSON.stringify(payload))
        const current = readIndex(userId).filter((e) => e.id !== id)
        const next: DraftIndexEntry[] = [
          { id, updatedAt: Date.now(), name },
          ...current,
        ]
        if (next.length > MAX_DRAFTS) {
          const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
          const evicted = sorted.slice(MAX_DRAFTS)
          for (const e of evicted) {
            try {
              localStorage.removeItem(draftKeyFor(userId, e.id))
            } catch {
              // silent fail
            }
          }
          writeIndex(userId, sorted.slice(0, MAX_DRAFTS))
        } else {
          writeIndex(userId, next)
        }
        notify()
      } catch {
        // silent fail
      }
    },
    [userId]
  )

  const deleteDraft = useCallback(
    (id: string) => {
      if (typeof window === 'undefined' || !userId) return
      try {
        localStorage.removeItem(draftKeyFor(userId, id))
        writeIndex(
          userId,
          readIndex(userId).filter((e) => e.id !== id)
        )
        notify()
      } catch {
        // silent fail
      }
    },
    [userId]
  )

  return {
    drafts,
    createDraftId,
    getDraft,
    saveDraft,
    deleteDraft,
  }
}

// Non-hook escape hatch — useful inside RHF watch callbacks and pure
// utilities where we can't call useAuth(). Callers must pass the current
// userId; this is the security boundary that isolates drafts per user.
export const objectDraftsStore = {
  read(uuid: string) {
    return readIndex(uuid)
  },
  get<T = unknown>(uuid: string, id: string): T | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(draftKeyFor(uuid, id))
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  save(uuid: string, id: string, payload: unknown, name: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(draftKeyFor(uuid, id), JSON.stringify(payload))
      const current = readIndex(uuid).filter((e) => e.id !== id)
      const next: DraftIndexEntry[] = [
        { id, updatedAt: Date.now(), name },
        ...current,
      ]
      const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
      if (sorted.length > MAX_DRAFTS) {
        const evicted = sorted.slice(MAX_DRAFTS)
        for (const e of evicted) {
          try {
            localStorage.removeItem(draftKeyFor(uuid, e.id))
          } catch {
            // silent fail
          }
        }
        writeIndex(uuid, sorted.slice(0, MAX_DRAFTS))
      } else {
        writeIndex(uuid, sorted)
      }
      notify()
    } catch {
      // silent fail
    }
  },
  delete(uuid: string, id: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(draftKeyFor(uuid, id))
      writeIndex(
        uuid,
        readIndex(uuid).filter((e) => e.id !== id)
      )
      notify()
    } catch {
      // silent fail
    }
  },
  MAX_DRAFTS,
}

// One-time cleanup of legacy un-namespaced draft keys created before user
// isolation existed. Old keys looked like `iom-drafts:objects:index` and
// `iom-drafts:objects:<draftId>` (no uuid segment). Since we can't safely
// attribute them to any user, drop them on app boot.
export function clearLegacyDrafts() {
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(`${ROOT}:`)) continue
      // New format has a uuid segment, then either `:index` or `:draft_<id>`.
      // Anything not matching the new shape is legacy.
      const rest = key.slice(ROOT.length + 1)
      const firstSep = rest.indexOf(':')
      if (firstSep === -1) {
        // e.g. `iom-drafts:objects:index` (legacy index)
        toRemove.push(key)
        continue
      }
      const head = rest.slice(0, firstSep)
      // Legacy draft payloads were `iom-drafts:objects:draft_<id>` — head
      // would start with `draft_` and there'd be no uuid before it.
      if (head.startsWith('draft_')) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      try {
        localStorage.removeItem(key)
      } catch {
        // silent fail
      }
    }
  } catch {
    // silent fail
  }
}

// Re-export used by tests
export { indexKeyFor, draftKeyFor, MAX_DRAFTS }
