import { isDraftRef } from '@/lib/utils'

import { objectDraftsStore } from '../hooks/use-object-drafts'

export type CreateObjectFn = (
  payload: any
) => Promise<{ success: boolean; uuid?: string }>

export interface ResolveDraftParentsError extends Error {
  failedDraftId: string
  partialResolved: string[]
  reason: 'missing-draft' | 'create-failed'
}

function makeError(
  message: string,
  failedDraftId: string,
  partialResolved: string[],
  reason: ResolveDraftParentsError['reason']
): ResolveDraftParentsError {
  const err = new Error(message) as ResolveDraftParentsError
  err.failedDraftId = failedDraftId
  err.partialResolved = partialResolved
  err.reason = reason
  return err
}

/**
 * Walk a parents array and commit any `draft_*` refs as real objects, in order,
 * before the outer object is submitted. The depth=1 invariant in the inline
 * parent creation flow guarantees that draft parents themselves cannot contain
 * draft parent refs, so no topological sort or cycle detection is needed.
 *
 * On success: each draft is deleted from the store, and the array is returned
 * with refs swapped for real UUIDs (real UUIDs in the input pass through
 * untouched).
 *
 * On failure: throws a `ResolveDraftParentsError` carrying the failed draft id
 * and the partial list of UUIDs that were successfully committed before the
 * failure — the caller can update form state to reflect the partial commit so
 * the user can retry without re-creating the parents that already succeeded.
 */
export async function resolveDraftParents(
  parents: string[],
  createObject: CreateObjectFn,
  onStep?: (current: number, total: number) => void
): Promise<string[]> {
  const draftIndices: number[] = []
  parents.forEach((p, i) => {
    if (isDraftRef(p)) draftIndices.push(i)
  })

  if (draftIndices.length === 0) return parents

  const resolved = [...parents]
  const total = draftIndices.length
  let stepNum = 0
  const partialResolved: string[] = []

  for (const idx of draftIndices) {
    stepNum += 1
    onStep?.(stepNum, total)

    const draftId = parents[idx]
    const payload = objectDraftsStore.get<any>(draftId)
    if (!payload) {
      throw makeError(
        `Parent draft ${draftId} not found in storage`,
        draftId,
        partialResolved,
        'missing-draft'
      )
    }

    const result = await createObject(payload)
    if (!result.success || !result.uuid) {
      throw makeError(
        `Failed to create parent from draft ${draftId}`,
        draftId,
        partialResolved,
        'create-failed'
      )
    }

    resolved[idx] = result.uuid
    partialResolved.push(result.uuid)
    objectDraftsStore.delete(draftId)
  }

  return resolved
}
