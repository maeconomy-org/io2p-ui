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

/** The source tree is deeper than `MAX_DUPLICATE_DEPTH`. Thrown before any write. */
export class DuplicateTooDeepError extends Error {
  constructor() {
    super(
      `The objects to copy are nested more than ${MAX_DUPLICATE_DEPTH} levels deep`
    )
    this.name = 'DuplicateTooDeepError'
  }
}

/**
 * The copy would create more than `MAX_DUPLICATE_OBJECTS` objects. Thrown before any write: the copy
 * runs object by object in the browser, so a big one takes minutes and a closed tab leaves part of
 * it behind.
 */
export class DuplicateTooLargeError extends Error {
  constructor() {
    super(`The copy would create more than ${MAX_DUPLICATE_OBJECTS} objects`)
    this.name = 'DuplicateTooLargeError'
  }
}

/**
 * A write failed after `created` copies. More than 0 means part of the copy stays behind.
 */
export class DuplicateWriteError extends Error {
  constructor(
    readonly created: number,
    override readonly cause: unknown
  ) {
    super(`The copy stopped after ${created} objects`)
    this.name = 'DuplicateWriteError'
  }
}

/** A subtree deeper than this is almost certainly a cycle or a mistake, not an intent. */
export const MAX_DUPLICATE_DEPTH = 10

/** Copies per run: every source and descendant, once per destination. */
export const MAX_DUPLICATE_OBJECTS = 500

/** Page size for the child walk. `paginate` walks every page, so this only sets the chunk. */
const CHILD_PAGE_SIZE = 100

interface CopyNode {
  id: string
  children: CopyNode[]
}

/**
 * The subtree to copy, read in full BEFORE any write, so the copy works from a snapshot its own
 * writes do not extend. `?parent=` because `?ancestor=` lags behind a write.
 */
async function readSubtree(
  client: Io2pClient,
  id: string,
  depth: number,
  budget: { left: number }
): Promise<CopyNode> {
  budget.left -= 1
  if (budget.left < 0) throw new DuplicateTooLargeError()
  const children: CopyNode[] = []
  for await (const child of client.objects.paginate({
    parent: id,
    size: CHILD_PAGE_SIZE,
    scope: 'all',
  })) {
    if (depth >= MAX_DUPLICATE_DEPTH) throw new DuplicateTooDeepError()
    children.push(await readSubtree(client, child.id, depth + 1, budget))
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
  params: DuplicateObjectsParams,
  progress: { created: number }
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
  progress.created += 1

  for (const child of node.children) {
    // The COPY's id, so the subtree hangs off the new branch rather than back onto the original.
    await duplicateNode(client, child, [created.id], params, progress)
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
        // Every planned node is copied once per destination. The walk stops as soon as the budget
        // runs out, so a huge tree is refused without being read to the end.
        const budget = {
          left: Math.floor(MAX_DUPLICATE_OBJECTS / destinations.length),
        }
        const plans: CopyNode[] = []
        for (const sourceId of params.sourceIds) {
          plans.push(
            params.includeChildren
              ? await readSubtree(client, sourceId, 0, budget)
              : { id: sourceId, children: [] }
          )
        }
        if (
          !params.includeChildren &&
          params.sourceIds.length * destinations.length > MAX_DUPLICATE_OBJECTS
        ) {
          throw new DuplicateTooLargeError()
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

        const progress = { created: 0 }
        try {
          for (const target of destinations) {
            for (const plan of plans) {
              await duplicateNode(
                client,
                plan,
                target ? [target] : [],
                params,
                progress
              )
            }
          }
        } catch (error) {
          throw new DuplicateWriteError(progress.created, error)
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
