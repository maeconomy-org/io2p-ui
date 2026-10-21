import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useSheetDraft } from '@/components/entity-sheet/hooks/use-sheet-draft'
import type { EntityDraft } from '@/lib/entity'

const draft = { name: 'Wall' } as EntityDraft

function store(saves = true) {
  let next = 0
  return {
    newDraftId: vi.fn(() => `minted-${++next}`),
    saveDraft: vi.fn<(id: string, draft: EntityDraft, name: string) => boolean>(
      () => saves
    ),
    deleteDraft: vi.fn(),
  }
}

describe('useSheetDraft', () => {
  it('keeps one draft across two saves, and discards that one', () => {
    const drafts = store()
    const { result } = renderHook(() => useSheetDraft(drafts, null))

    result.current.write(draft, 'Wall')
    result.current.write(draft, 'Wall')
    result.current.discard()

    expect(drafts.saveDraft.mock.calls.map(([id]) => id)).toEqual([
      'minted-1',
      'minted-1',
    ])
    expect(drafts.deleteDraft).toHaveBeenCalledWith('minted-1')
  })

  it('saves a resumed draft under its own id', () => {
    const drafts = store()
    const { result } = renderHook(() => useSheetDraft(drafts, 'resumed-1'))

    result.current.write(draft, 'Wall')
    result.current.discard()

    expect(drafts.newDraftId).not.toHaveBeenCalled()
    expect(drafts.saveDraft).toHaveBeenCalledWith('resumed-1', draft, 'Wall')
    expect(drafts.deleteDraft).toHaveBeenCalledWith('resumed-1')
  })

  it('remembers no id when the save failed', () => {
    const drafts = store(false)
    const { result } = renderHook(() => useSheetDraft(drafts, null))

    expect(result.current.write(draft, 'Wall')).toBe(false)
    result.current.discard()

    expect(drafts.deleteDraft).not.toHaveBeenCalled()
  })
})
