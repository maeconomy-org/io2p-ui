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

/**
 * The source tree is deeper than `MAX_DUPLICATE_DEPTH`. Thrown before any write, so nothing was
 * copied; the copy used to stop at this depth silently and report success.
 */
export class DuplicateTooDeepError extends Error {
  constructor() {
    super(
      `The objects to copy are nested more than ${MAX_DUPLICATE_DEPTH} levels deep`
    )
    this.name = 'DuplicateTooDeepError'
  }
}

/** A subtree deeper than this is almost certainly a cycle or a mistake, not an intent. */
export const MAX_DUPLICATE_DEPTH = 10

/** Page size for the child walk. `paginate` walks every page, so this only sets the chunk. */
const CHILD_PAGE_SIZE = 100

interface CopyNode {
  id: string
  children: CopyNode[]
}

/**
 * The subtree to copy, read in full BEFORE any write.
 *
 * `?parent=` is the IMMEDIATE children — `?ancestor=` lags behind a write — and `paginate`, not one
 * `list`: a single page silently stopped at 100 children. Reading first means the copy works from a
 * stable snapshot rather than a list its own writes are extending, and a tree that is too deep (or a
 * cycle in the data) is refused before anything exists.
 */
async function readSubtree(
  client: Io2pClient,
  id: string,
  depth: number
): Promise<CopyNode> {
  const children: CopyNode[] = []
  for await (const child of client.objects.paginate({
    parent: id,
    size: CHILD_PAGE_SIZE,
    scope: 'all',
  })) {
    if (depth >= MAX_DUPLICATE_DEPTH) throw new DuplicateTooDeepError()
    children.push(await readSubtree(client, child.id, depth + 1))
  }
  return { id, children }
}

function containsId(node: CopyNode, id: string): boolean {
  return node.id === id || node.children.some((child) => containsId(child, id))
}

/**
 * One object and its planned subtree.
 *
 * Recursive, so it lives OUTSIDE the hook: a `useCallback` that calls itself reads its own binding
 * from the previous render, which the compiler lint flags and which would hold a stale `client`.
 */
async function duplicateNode(
  client: Io2pClient,
  node: CopyNode,
  parentIds: string[],
  params: DuplicateObjectsParams
): Promise<void> {
  const source = await client.objects.get(node.id)
  const created = await client.objects.create(
    objectToDuplicateInput(source, {
      namePrefix: params.namePrefix,
      parentIds,
      copyProperties: params.copyProperties,
      copyFiles: params.copyFiles,
      copyAddress: params.copyAddress,
    })
  )

  for (const child of node.children) {
    // The COPY's id, so the subtree hangs off the new branch rather than back onto the original.
    await duplicateNode(client, child, [created.id], params)
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
        const plans: CopyNode[] = []
        for (const sourceId of params.sourceIds) {
          plans.push(
            params.includeChildren
              ? await readSubtree(client, sourceId, 0)
              : { id: sourceId, children: [] }
          )
        }
        // Checked for EVERY pair before anything is written: discovering it half-way would leave a
        // partial subtree behind. Only when children travel: one flat object landing under a
        // descendant is legal, if odd.
        if (params.includeChildren) {
          for (const target of destinations) {
            if (target && plans.some((plan) => containsId(plan, target))) {
              throw new DuplicateIntoOwnSubtreeError()
            }
          }
        }

        for (const target of destinations) {
          for (const plan of plans) {
            await duplicateNode(client, plan, target ? [target] : [], params)
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
