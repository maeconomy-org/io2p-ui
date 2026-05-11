import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
  useObjectDrafts,
  objectDraftsStore,
  INDEX_KEY,
  DRAFT_KEY_PREFIX,
  MAX_DRAFTS,
} from '@/components/object-sheets/hooks/use-object-drafts'

describe('useObjectDrafts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('createDraftId', () => {
    it('produces draft_-prefixed unique ids', () => {
      const { result } = renderHook(() => useObjectDrafts())
      const id1 = result.current.createDraftId()
      const id2 = result.current.createDraftId()
      expect(id1).toMatch(/^draft_/)
      expect(id2).toMatch(/^draft_/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('save / get / delete round-trip', () => {
    it('persists and retrieves a draft payload by id', () => {
      const { result } = renderHook(() => useObjectDrafts())
      const id = 'draft_abc'
      const payload = { name: 'foo', properties: [{ key: 'k', values: [] }] }

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
        result.current.saveDraft(id, { name: 'bar' }, 'bar')
      })
      expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`)).not.toBeNull()

      act(() => {
        result.current.deleteDraft(id)
      })

      expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`)).toBeNull()
      expect(result.current.drafts).toHaveLength(0)
    })
  })

  describe('index sorting', () => {
    it('returns drafts ordered by updatedAt descending', () => {
      const { result } = renderHook(() => useObjectDrafts())

      // Write index directly with controlled timestamps so we don't race the
      // real Date.now() clock between saves.
      act(() => {
        localStorage.setItem(
          INDEX_KEY,
          JSON.stringify([
            { id: 'a', name: 'a', updatedAt: 1000 },
            { id: 'b', name: 'b', updatedAt: 3000 },
            { id: 'c', name: 'c', updatedAt: 2000 },
          ])
        )
        // Trigger storage event manually since same-tab setItem doesn't fire one
        window.dispatchEvent(new StorageEvent('storage', { key: INDEX_KEY }))
      })

      expect(result.current.drafts.map((d) => d.id)).toEqual(['b', 'c', 'a'])
    })
  })

  describe('cap at MAX_DRAFTS', () => {
    it(`evicts oldest entries beyond ${MAX_DRAFTS}`, () => {
      // Pre-populate with MAX_DRAFTS entries via the store API (not the hook —
      // we don't need React reactivity here, just storage assertions).
      for (let i = 0; i < MAX_DRAFTS; i++) {
        objectDraftsStore.save(`draft_${i}`, { idx: i }, `name_${i}`)
      }
      expect(objectDraftsStore.read()).toHaveLength(MAX_DRAFTS)

      // Adding one more must evict the oldest (draft_0).
      objectDraftsStore.save('draft_new', { idx: 999 }, 'newest')

      const index = objectDraftsStore.read()
      expect(index).toHaveLength(MAX_DRAFTS)
      expect(index.find((e) => e.id === 'draft_new')).toBeDefined()
      expect(index.find((e) => e.id === 'draft_0')).toBeUndefined()
      // Evicted payload must be removed too — not just unlinked from the index.
      expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_0`)).toBeNull()
    })
  })

  describe('cross-tab sync via storage event', () => {
    it('re-renders subscribers when another tab updates the index', () => {
      const { result } = renderHook(() => useObjectDrafts())
      expect(result.current.drafts).toHaveLength(0)

      // Simulate a write from another tab: setItem alone doesn't fire a
      // storage event in the SAME tab, so we dispatch one explicitly.
      act(() => {
        localStorage.setItem(
          INDEX_KEY,
          JSON.stringify([{ id: 'remote', name: 'remote', updatedAt: 1 }])
        )
        window.dispatchEvent(new StorageEvent('storage', { key: INDEX_KEY }))
      })

      expect(result.current.drafts).toHaveLength(1)
      expect(result.current.drafts[0].id).toBe('remote')
    })
  })

  describe('malformed storage', () => {
    it('returns an empty list when the index is unparseable', () => {
      localStorage.setItem(INDEX_KEY, '{not-json')
      const { result } = renderHook(() => useObjectDrafts())
      expect(result.current.drafts).toEqual([])
    })

    it('returns null from getDraft when payload is unparseable', () => {
      const { result } = renderHook(() => useObjectDrafts())
      localStorage.setItem(`${DRAFT_KEY_PREFIX}broken`, '{nope')
      expect(result.current.getDraft('broken')).toBeNull()
    })
  })
})
