'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { useAuth } from '@/contexts/auth-context'
import type { DraftFile, EntityDraft } from '@/lib/entity'

const ROOT = 'iom-drafts:objects'

/** Oldest drafts past this are evicted on save. localStorage is ~5 MB per origin, shared. */
export const MAX_DRAFTS = 25

const indexKeyFor = (userId: string) => `${ROOT}:${userId}:index`
const draftKeyFor = (userId: string, id: string) => `${ROOT}:${userId}:${id}`

export interface DraftIndexEntry {
  id: string
  updatedAt: number
  name: string
}

/**
 * A pending upload is a `File` handle, which does not survive `JSON.stringify` — it serializes to
 * `{}` and comes back as a file with no bytes and no name. Dropping those picks is the honest
 * option: the alternative is a restored draft whose file rows look real and upload nothing.
 */
function withoutPendingUploads(files?: DraftFile[]): DraftFile[] | undefined {
  if (!files) return undefined
  const keep = files.filter((f) => !f.blob)
  return keep.length ? keep : undefined
}

function serializable(draft: EntityDraft): EntityDraft {
  return {
    ...draft,
    files: withoutPendingUploads(draft.files),
    properties: draft.properties.map((p) => ({
      ...p,
      files: withoutPendingUploads(p.files),
      values: p.values.map((v) => ({
        ...v,
        files: withoutPendingUploads(v.files),
      })),
    })),
  }
}

function readIndex(userId: string): DraftIndexEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(indexKeyFor(userId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as DraftIndexEntry[]) : []
  } catch {
    return []
  }
}

const listeners = new Set<() => void>()

/**
 * Non-hook access, for callers that cannot use `useAuth()`. `userId` is a required argument rather
 * than ambient state because it is the isolation boundary: two accounts on one browser must never
 * see each other's drafts.
 */
export const objectDraftsStore = {
  list(userId: string): DraftIndexEntry[] {
    return [...readIndex(userId)].sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(userId: string, id: string): EntityDraft | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(draftKeyFor(userId, id))
      return raw ? (JSON.parse(raw) as EntityDraft) : null
    } catch {
      return null
    }
  },

  /** `false` when nothing was written, so the caller can avoid claiming a save that did not happen. */
  save(userId: string, id: string, draft: EntityDraft, name: string): boolean {
    if (typeof window === 'undefined') return false
    try {
      localStorage.setItem(
        draftKeyFor(userId, id),
        JSON.stringify(serializable(draft))
      )
      const next = [
        { id, updatedAt: Date.now(), name },
        ...readIndex(userId).filter((e) => e.id !== id),
      ].sort((a, b) => b.updatedAt - a.updatedAt)

      for (const evicted of next.slice(MAX_DRAFTS)) {
        localStorage.removeItem(draftKeyFor(userId, evicted.id))
      }
      localStorage.setItem(
        indexKeyFor(userId),
        JSON.stringify(next.slice(0, MAX_DRAFTS))
      )
      listeners.forEach((l) => l())
      return true
    } catch {
      // A quota error must not take the sheet down with it — the user's real move is Save, and the
      // draft is a convenience.
      return false
    }
  },

  delete(userId: string, id: string) {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(draftKeyFor(userId, id))
      localStorage.setItem(
        indexKeyFor(userId),
        JSON.stringify(readIndex(userId).filter((e) => e.id !== id))
      )
      listeners.forEach((l) => l())
    } catch {
      // see save()
    }
  },

  newId(): string {
    return `draft_${crypto.randomUUID()}`
  },
}

function subscribe(userId: string | undefined) {
  return (listener: () => void) => {
    listeners.add(listener)
    // Another TAB writing drafts fires `storage`, not our in-process listener set.
    const key = userId ? indexKeyFor(userId) : null
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

// `useSyncExternalStore` compares snapshots by identity, so this returns the raw JSON string and
// parsing happens after. Returning a fresh array here would re-render on every check.
function getSnapshot(userId: string | undefined) {
  return () => {
    if (typeof window === 'undefined' || !userId) return '[]'
    return localStorage.getItem(indexKeyFor(userId)) ?? '[]'
  }
}

const getServerSnapshot = () => '[]'

export function useObjectDrafts() {
  const { userId } = useAuth()

  const indexRaw = useSyncExternalStore(
    subscribe(userId),
    getSnapshot(userId),
    getServerSnapshot
  )

  let drafts: DraftIndexEntry[] = []
  if (userId) {
    try {
      const parsed = JSON.parse(indexRaw)
      if (Array.isArray(parsed)) {
        drafts = [...(parsed as DraftIndexEntry[])].sort(
          (a, b) => b.updatedAt - a.updatedAt
        )
      }
    } catch {
      drafts = []
    }
  }

  const getDraft = useCallback(
    (id: string) => (userId ? objectDraftsStore.get(userId, id) : null),
    [userId]
  )

  /**
   * `false` when there is no signed-in id yet. Drafts key on the user, so a save fired before `/me`
   * resolves has nowhere to go — it used to no-op while the sheet still reported success.
   */
  const saveDraft = useCallback(
    (id: string, draft: EntityDraft, name: string): boolean =>
      userId ? objectDraftsStore.save(userId, id, draft, name) : false,
    [userId]
  )

  const deleteDraft = useCallback(
    (id: string) => {
      if (userId) objectDraftsStore.delete(userId, id)
    },
    [userId]
  )

  return {
    drafts,
    newDraftId: objectDraftsStore.newId,
    getDraft,
    saveDraft,
    deleteDraft,
  }
}

/**
 * One-time cleanup of un-namespaced keys written before drafts were isolated per user. The old
 * shape was `iom-drafts:objects:index` / `iom-drafts:objects:draft_<id>` — no user segment — so
 * they cannot be attributed to anyone and are dropped rather than migrated.
 */
export function clearLegacyDrafts() {
  if (typeof window === 'undefined') return
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(`${ROOT}:`)) continue
      const rest = key.slice(ROOT.length + 1)
      const sep = rest.indexOf(':')
      if (sep === -1 || rest.slice(0, sep).startsWith('draft_')) stale.push(key)
    }
    stale.forEach((key) => localStorage.removeItem(key))
  } catch {
    // see save()
  }
}

export { indexKeyFor, draftKeyFor }
