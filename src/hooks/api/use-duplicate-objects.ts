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

/** A subtree deeper than this is almost certainly a cycle or a mistake, not an intent. */
const MAX_DEPTH = 10

/** One page of children per level — a level wider than this is a different feature's problem. */
const CHILD_PAGE_SIZE = 100

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
  const children = await client.objects.list({
    parent: sourceId,
    page: 1,
    size: CHILD_PAGE_SIZE,
    scope: 'all',
  })

  for (const child of children.data) {
    // The COPY's id, so the subtree hangs off the new branch rather than back onto the original.
    await duplicateOne(client, child.id, [created.id], params, depth + 1)
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
