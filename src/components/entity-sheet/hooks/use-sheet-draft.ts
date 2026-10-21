import { useRef } from 'react'

import type { EntityDraft } from '@/lib/entity'

interface DraftStore {
  newDraftId: () => string
  saveDraft: (id: string, draft: EntityDraft, name: string) => boolean
  deleteDraft: (id: string) => void
}

/**
 * The one draft a create sheet keeps: the resumed one, else the first one saved here. Saving
 * twice updates that draft instead of adding a second copy of the same work.
 */
export function useSheetDraft(
  drafts: DraftStore,
  resumedId: string | null | undefined
) {
  const minted = useRef<string | null>(null)

  const write = (draft: EntityDraft, name: string): boolean => {
    const id = resumedId ?? minted.current ?? drafts.newDraftId()
    const saved = drafts.saveDraft(id, draft, name)
    if (saved && !resumedId) minted.current = id
    return saved
  }

  const discard = () => {
    const id = resumedId ?? minted.current
    if (id) drafts.deleteDraft(id)
  }

  return { write, discard }
}
