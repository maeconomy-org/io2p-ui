import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  useObjectDrafts,
  objectDraftsStore,
  indexKeyFor,
  draftKeyFor,
  clearLegacyDrafts,
  MAX_DRAFTS,
} from '@/hooks/drafts/use-object-drafts'
import type { EntityDraft } from '@/lib/entity'

const USER_A = 'user-a-uuid'
const USER_B = 'user-b-uuid'

let currentUserId: string | undefined = USER_A

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userId: currentUserId }),
}))

function draft(overrides: Partial<EntityDraft> = {}): EntityDraft {
  return { name: 'foo', parentIds: [], properties: [], ...overrides }
}

describe('useObjectDrafts', () => {
  beforeEach(() => {
    localStorage.clear()
    currentUserId = USER_A
  })

  describe('newDraftId', () => {
    it('produces draft_-prefixed unique ids', () => {
      const { result } = renderHook(() => useObjectDrafts())
      const id1 = result.current.newDraftId()
      const id2 = result.current.newDraftId()
      expect(id1).toMatch(/^draft_/)
      expect(id2).toMatch(/^draft_/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('save / get / delete round-trip', () => {
    it('persists and retrieves a draft by id', () => {
      const { result } = renderHook(() => useObjectDrafts())
      const id = 'draft_abc'
      const payload = draft({ properties: [{ key: 'k', values: [] }] })

      act(() => {
        result.current.saveDraft(id, payload, 'foo')
      })

      expect(result.current.getDraft(id)).toEqual(payload)
      expect(result.current.drafts).toHaveLength(1)
      expect(result.current.drafts[0]).toMatchObject({ id, name: 'foo' })
    })

    it('removes both the index entry and the payload on delete', () => {
      const { result } = renderHook(() => useObjectDrafts())
      const id = 'draft_xyz'

      act(() => {
        result.current.saveDraft(id, draft({ name: 'bar' }), 'bar')
      })
      expect(localStorage.getItem(draftKeyFor(USER_A, id))).not.toBeNull()

      act(() => {
        result.current.deleteDraft(id)
      })

      expect(localStorage.getItem(draftKeyFor(USER_A, id))).toBeNull()
      expect(result.current.drafts).toHaveLength(0)
    })
  })

  describe('pending uploads', () => {
    // A File does not survive JSON.stringify — it serializes to {}. Keeping the entry would restore
    // a file row with no bytes and no name, which uploads nothing and looks like it will.
    it('drops picked blobs but keeps external references', () => {
      const blob = new File(['x'], 'pick.png', { type: 'image/png' })
      const payload = draft({
        files: [
          { _localId: '1', kind: 'upload', blob },
          {
            _localId: '2',
            kind: 'reference',
            reference: { url: 'https://example.com/a.pdf' },
          },
        ],
        properties: [
          {
            key: 'k',
            values: [
              { data: 'v', files: [{ _localId: '3', kind: 'upload', blob }] },
            ],
            files: [{ _localId: '4', kind: 'upload', blob }],
          },
        ],
      })

      objectDraftsStore.save(USER_A, 'draft_files', payload, 'files')
      const restored = objectDraftsStore.get(USER_A, 'draft_files')

      expect(restored?.files).toHaveLength(1)
      expect(restored?.files?.[0].kind).toBe('reference')
      // An array emptied by the filter is dropped entirely rather than left as [].
      expect(restored?.properties[0].files).toBeUndefined()
      expect(restored?.properties[0].values[0].files).toBeUndefined()
    })

    it('leaves the caller draft untouched when stripping', () => {
      const blob = new File(['x'], 'pick.png', { type: 'image/png' })
      const payload = draft({
        files: [{ _localId: '1', kind: 'upload', blob }],
      })

      objectDraftsStore.save(USER_A, 'draft_x', payload, 'x')

      expect(payload.files).toHaveLength(1)
    })
  })

  describe('per-user isolation', () => {
    it('does not expose user A drafts to user B', () => {
      const { result, rerender } = renderHook(() => useObjectDrafts())
      act(() => {
        result.current.saveDraft('draft_a', draft({ name: 'A' }), 'A')
      })
      expect(result.current.drafts).toHaveLength(1)

      currentUserId = USER_B
      rerender()
      expect(result.current.drafts).toHaveLength(0)
      expect(result.current.getDraft('draft_a')).toBeNull()
    })

    it('restores the same user drafts after a logout/login round-trip', () => {
      const { result, rerender } = renderHook(() => useObjectDrafts())
      const payload = draft({ name: 'A' })
      act(() => {
        result.current.saveDraft('draft_a', payload, 'A')
      })

      currentUserId = undefined
      rerender()
      expect(result.current.drafts).toHaveLength(0)

      currentUserId = USER_A
      rerender()
      expect(result.current.drafts).toHaveLength(1)
      expect(result.current.drafts[0].id).toBe('draft_a')
      expect(result.current.getDraft('draft_a')).toEqual(payload)
    })
  })

  describe('index sorting', () => {
    it('returns drafts ordered by updatedAt descending', () => {
      const { result } = renderHook(() => useObjectDrafts())

      act(() => {
        localStorage.setItem(
          indexKeyFor(USER_A),
          JSON.stringify([
            { id: 'a', name: 'a', updatedAt: 1000 },
            { id: 'b', name: 'b', updatedAt: 3000 },
            { id: 'c', name: 'c', updatedAt: 2000 },
          ])
        )
        window.dispatchEvent(
          new StorageEvent('storage', { key: indexKeyFor(USER_A) })
        )
      })

      expect(result.current.drafts.map((d) => d.id)).toEqual(['b', 'c', 'a'])
    })
  })

  describe('cap at MAX_DRAFTS', () => {
    it(`evicts oldest entries beyond ${MAX_DRAFTS}`, () => {
      for (let i = 0; i < MAX_DRAFTS; i++) {
        objectDraftsStore.save(
          USER_A,
          `draft_${i}`,
          draft({ name: `n${i}` }),
          `name_${i}`
        )
      }
      expect(objectDraftsStore.list(USER_A)).toHaveLength(MAX_DRAFTS)

      objectDraftsStore.save(USER_A, 'draft_new', draft(), 'newest')

      const index = objectDraftsStore.list(USER_A)
      expect(index).toHaveLength(MAX_DRAFTS)
      expect(index.find((e) => e.id === 'draft_new')).toBeDefined()
      expect(index.find((e) => e.id === 'draft_0')).toBeUndefined()
      // The evicted entry's payload goes too, or localStorage leaks orphans forever.
      expect(localStorage.getItem(draftKeyFor(USER_A, 'draft_0'))).toBeNull()
    })
  })

  describe('cross-tab sync via storage event', () => {
    it('re-renders subscribers when another tab updates the index', () => {
      const { result } = renderHook(() => useObjectDrafts())
      expect(result.current.drafts).toHaveLength(0)

      act(() => {
        localStorage.setItem(
          indexKeyFor(USER_A),
          JSON.stringify([{ id: 'remote', name: 'remote', updatedAt: 1 }])
        )
        window.dispatchEvent(
          new StorageEvent('storage', { key: indexKeyFor(USER_A) })
        )
      })

      expect(result.current.drafts).toHaveLength(1)
      expect(result.current.drafts[0].id).toBe('remote')
    })
  })

  describe('malformed storage', () => {
    it('returns an empty list when the index is unparseable', () => {
      localStorage.setItem(indexKeyFor(USER_A), '{not-json')
      const { result } = renderHook(() => useObjectDrafts())
      expect(result.current.drafts).toEqual([])
    })

    it('returns null from getDraft when the payload is unparseable', () => {
      const { result } = renderHook(() => useObjectDrafts())
      localStorage.setItem(draftKeyFor(USER_A, 'broken'), '{nope')
      expect(result.current.getDraft('broken')).toBeNull()
    })
  })

  describe('clearLegacyDrafts', () => {
    it('removes legacy un-namespaced keys but preserves user-scoped keys', () => {
      localStorage.setItem('iom-drafts:objects:index', '[]')
      localStorage.setItem('iom-drafts:objects:draft_legacy', '{"name":"old"}')

      localStorage.setItem(indexKeyFor(USER_A), '[]')
      localStorage.setItem(draftKeyFor(USER_A, 'draft_new'), '{"name":"new"}')

      clearLegacyDrafts()

      expect(localStorage.getItem('iom-drafts:objects:index')).toBeNull()
      expect(localStorage.getItem('iom-drafts:objects:draft_legacy')).toBeNull()
      expect(localStorage.getItem(indexKeyFor(USER_A))).not.toBeNull()
      expect(
        localStorage.getItem(draftKeyFor(USER_A, 'draft_new'))
      ).not.toBeNull()
    })
  })
})
