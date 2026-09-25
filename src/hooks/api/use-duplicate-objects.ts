'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Io2pClient } from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { objectToDuplicateInput } from '@/lib/entity'

export interface DuplicateObjectsParams {
  sourceIds: string[]
  /** Every destination gets its own copy of every source. Empty means duplicate as a root. */
  targetParentIds: string[]
  namePrefix?: string
  includeChildren?: boolean
  copyProperties?: boolean
  copyFiles?: boolean
  copyAddress?: boolean
}

/**
 * The destination sits inside the subtree being copied. A typed error rather
 * than a toast from the hook: the hook does not own the UI, and the sheet needs
 * to tell this apart from a network failure to say something useful.
 */
export class DuplicateIntoOwnSubtreeError extends Error {
  constructor() {
    super('The destination is inside the objects being copied')
    this.name = 'DuplicateIntoOwnSubtreeError'
  }
}

/** A subtree deeper than this is almost certainly a cycle or a mistake, not an intent. */
const MAX_DEPTH = 10

/** Page size for the child walk. `paginate` walks every page, so this only sets the chunk. */
const CHILD_PAGE_SIZE = 100

/**
 * Would copying `sourceId` into `targetId` put the copy inside its own subtree?
 *
 * Only asked when children travel: without them the copy is one flat object and
 * landing it under a descendant is legal, if odd. With them, the walk descends
 * the ORIGINAL tree and writes into the new branch, so it terminates — but it
 * buries a duplicate of the whole subtree inside one of its own members, and
 * `MAX_DEPTH` truncates the result silently.
 *
 * `?ancestor=` is right here where the child walk avoids it: this is a one-shot
 * read BEFORE any write, so the index lagging a write cannot affect it.
 */
async function targetIsInsideSource(
  client: Io2pClient,
  sourceId: string,
  targetId: string
): Promise<boolean> {
  if (sourceId === targetId) return true

  for await (const descendant of client.objects.paginate({
    ancestor: sourceId,
    size: CHILD_PAGE_SIZE,
    scope: 'all',
  })) {
    if (descendant.id === targetId) return true
  }
  return false
}

/**
 * One object and, optionally, its subtree.
 *
 * Recursive, so it lives OUTSIDE the hook: a `useCallback` that calls itself reads its own binding
 * from the previous render, which the compiler lint flags and which would hold a stale `client`.
 */
async function duplicateOne(
  client: Io2pClient,
  sourceId: string,
  parentIds: string[],
  params: DuplicateObjectsParams,
  depth: number
): Promise<void> {
  const source = await client.objects.get(sourceId)
  const created = await client.objects.create(
    objectToDuplicateInput(source, {
      namePrefix: params.namePrefix,
      parentIds,
      copyProperties: params.copyProperties,
      copyFiles: params.copyFiles,
      copyAddress: params.copyAddress,
    })
  )

  if (!params.includeChildren || depth >= MAX_DEPTH) return

  // `?parent=` is the IMMEDIATE children — `?ancestor=` lags behind a write, and this walks the
  // tree itself, so it needs the level that is already correct.
  //
  // `paginate`, not one `list`: a single page silently stopped at 100 children, so copying a
  // floor with 150 rooms produced 100 and reported success. The ids are collected BEFORE any
  // copy is created, so the walk reads a stable snapshot of the source rather than a list its
  // own writes are extending.
  const childIds: string[] = []
  for await (const child of client.objects.paginate({
    parent: sourceId,
    size: CHILD_PAGE_SIZE,
    scope: 'all',
  })) {
    childIds.push(child.id)
  }

  for (const childId of childIds) {
    // The COPY's id, so the subtree hangs off the new branch rather than back onto the original.
    await duplicateOne(client, childId, [created.id], params, depth + 1)
  }
}

/**
 * Recreate objects somewhere else — the "these rooms again, on the next floor" case.
 *
 * On the retired node this took four steps: map the aggregate to an import shape, create it, author
 * `IS_PARENT_OF` statements, then copy file references. io2p accepts the whole authored tree —
 * properties, values, address and PARENTS — in a single create, so 317 lines collapse to this.
 *
 * Sequential rather than `Promise.all`: a partial failure should stop with some copies made and the
 * rest not, instead of scattering an unknown subset across the tree.
 */
export function useDuplicateObjects() {
  const client = useIomClient()
  const qc = useQueryClient()
  const [isDuplicating, setIsDuplicating] = useState(false)

  const duplicateObjects = useCallback(
    async (params: DuplicateObjectsParams) => {
      setIsDuplicating(true)
      try {
        // No destination means duplicate as a root, which `''` expresses without a second branch.
        const destinations = params.targetParentIds.length
          ? params.targetParentIds
          : ['']
        // Checked for EVERY pair before anything is written: discovering it
        // half-way would leave a partial subtree behind, which is exactly the
        // state this refuses to create.
        if (params.includeChildren) {
          for (const target of destinations) {
            if (!target) continue
            for (const sourceId of params.sourceIds) {
              if (await targetIsInsideSource(client, sourceId, target)) {
                throw new DuplicateIntoOwnSubtreeError()
              }
            }
          }
        }

        for (const target of destinations) {
          for (const sourceId of params.sourceIds) {
            await duplicateOne(
              client,
              sourceId,
              target ? [target] : [],
              params,
              0
            )
          }
        }
      } finally {
        setIsDuplicating(false)
        qc.invalidateQueries({ queryKey: queryKeys.objects.all })
      }
    },
    [client, qc]
  )

  return { duplicateObjects, isDuplicating }
}
