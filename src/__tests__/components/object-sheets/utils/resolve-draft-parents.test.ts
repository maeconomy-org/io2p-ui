import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  resolveDraftParents,
  type ResolveDraftParentsError,
} from '@/components/object-sheets/utils/resolve-draft-parents'
import {
  objectDraftsStore,
  DRAFT_KEY_PREFIX,
} from '@/components/object-sheets/hooks/use-object-drafts'

describe('resolveDraftParents', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the input unchanged when no draft refs are present', async () => {
    const createObject = vi.fn()
    const onStep = vi.fn()
    const real = ['00000000-0000-0000-0000-000000000001', 'b', 'c']

    const result = await resolveDraftParents(real, createObject, onStep)

    expect(result).toEqual(real)
    expect(createObject).not.toHaveBeenCalled()
    expect(onStep).not.toHaveBeenCalled()
  })

  it('commits a single draft parent and swaps in the new uuid', async () => {
    const draftId = 'draft_abc'
    objectDraftsStore.save(draftId, { name: 'parent A' }, 'parent A')

    const createObject = vi
      .fn()
      .mockResolvedValue({ success: true, uuid: 'real-uuid-1' })

    const onStep = vi.fn()
    const result = await resolveDraftParents(
      [draftId, 'real-existing'],
      createObject,
      onStep
    )

    expect(result).toEqual(['real-uuid-1', 'real-existing'])
    expect(createObject).toHaveBeenCalledTimes(1)
    expect(createObject).toHaveBeenCalledWith({ name: 'parent A' })
    expect(onStep).toHaveBeenCalledWith(1, 1)
    // Draft must be removed from storage on success
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}${draftId}`)).toBeNull()
  })

  it('commits a multi-draft batch in array order with onStep callbacks', async () => {
    objectDraftsStore.save('draft_a', { name: 'a' }, 'a')
    objectDraftsStore.save('draft_b', { name: 'b' }, 'b')
    objectDraftsStore.save('draft_c', { name: 'c' }, 'c')

    const createObject = vi
      .fn()
      .mockResolvedValueOnce({ success: true, uuid: 'uuid-a' })
      .mockResolvedValueOnce({ success: true, uuid: 'uuid-b' })
      .mockResolvedValueOnce({ success: true, uuid: 'uuid-c' })

    const onStep = vi.fn()
    const result = await resolveDraftParents(
      ['draft_a', 'real-mixed-in', 'draft_b', 'draft_c'],
      createObject,
      onStep
    )

    expect(result).toEqual(['uuid-a', 'real-mixed-in', 'uuid-b', 'uuid-c'])
    expect(onStep.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_a`)).toBeNull()
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_b`)).toBeNull()
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_c`)).toBeNull()
  })

  it('throws on mid-batch failure, preserves committed parents and leaves uncommitted drafts intact', async () => {
    objectDraftsStore.save('draft_a', { name: 'a' }, 'a')
    objectDraftsStore.save('draft_b', { name: 'b' }, 'b')
    objectDraftsStore.save('draft_c', { name: 'c' }, 'c')

    const createObject = vi
      .fn()
      .mockResolvedValueOnce({ success: true, uuid: 'uuid-a' })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true, uuid: 'uuid-c' })

    let caught: ResolveDraftParentsError | null = null
    try {
      await resolveDraftParents(['draft_a', 'draft_b', 'draft_c'], createObject)
    } catch (e) {
      caught = e as ResolveDraftParentsError
    }

    expect(caught).not.toBeNull()
    expect(caught!.failedDraftId).toBe('draft_b')
    expect(caught!.reason).toBe('create-failed')
    expect(caught!.partialResolved).toEqual(['uuid-a'])
    // a was committed → its draft is gone; b/c never reached the delete step → still in storage
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_a`)).toBeNull()
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_b`)).not.toBeNull()
    expect(localStorage.getItem(`${DRAFT_KEY_PREFIX}draft_c`)).not.toBeNull()
    // c's createObject mock was prepared but should never have been invoked
    expect(createObject).toHaveBeenCalledTimes(2)
  })

  it('throws missing-draft when the storage payload is gone', async () => {
    const createObject = vi.fn()

    let caught: ResolveDraftParentsError | null = null
    try {
      await resolveDraftParents(['draft_ghost'], createObject)
    } catch (e) {
      caught = e as ResolveDraftParentsError
    }

    expect(caught).not.toBeNull()
    expect(caught!.failedDraftId).toBe('draft_ghost')
    expect(caught!.reason).toBe('missing-draft')
    expect(caught!.partialResolved).toEqual([])
    expect(createObject).not.toHaveBeenCalled()
  })
})
