'use client'

// Which processes reference this object — the reverse of a flow.
//
// io2p models the relation on the PROCESS (`inputs[]`/`outputs[]` pointing at object ids), so an
// object holds no back-reference and this cannot be read off the object at all. `?ref=<objectId>`
// on the processes list is the server-side reverse index; before it existed the only honest answer
// was to sweep every process and filter client-side, which is why this tab did not exist.

import { useQuery } from '@tanstack/react-query'
import type { Io2pClient, ProcessListItem } from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { logger } from '@/lib/observability/logger'
import { QUANTITY_KEY } from '@/lib/entity'
import { queryKeys } from '@/lib/query-keys'

const RELATIONS_PAGE_SIZE = 25

const STALE_TIME = 30_000

export type FlowDirection = 'input' | 'output'

export interface RelatedFlow {
  id: string
  /** Authored quantity string, e.g. `"0.1 t"`. Absent when the flow carries no quantity. */
  quantity?: string
}

export interface ProcessRelation {
  process: ProcessListItem
  /** The flows on the queried side pointing at this object — a process may reference it twice. */
  flows: RelatedFlow[]
}

export interface RelationGroup {
  relations: ProcessRelation[]
  /** Matching processes in total, which can exceed the page that was fetched. */
  total: number
}

/**
 * The flow's quantity as authored.
 *
 * `quantity` is a UI convention rather than a protocol field — io2p keeps domain semantics above the
 * protocol — so it is an ordinary property that happens to be the one worth showing on a row. The
 * authored string is used, not the normalizer's `num`/`unit`: those exist to make values comparable,
 * and nothing here compares anything.
 */
function flowQuantity(
  flow: ProcessListItem['inputs'][number]
): string | undefined {
  const property = flow.properties?.find(
    (p) => p.key === QUANTITY_KEY && !p.deleted
  )
  return property?.values.find((v) => !v.deleted)?.data
}

async function fetchRelations(
  client: Io2pClient,
  objectId: string,
  direction: FlowDirection,
  signal?: AbortSignal
): Promise<RelationGroup> {
  // `full: true` because a lean flow is a thin `{id, ref, refName}` and the quantity lives in the
  // flow's own properties. `enrichFiles: false` because nothing here renders a file — the same
  // full-but-light pairing the graph sweep uses.
  // `scope: 'all'`: the default is `mine`, which would hide a shared process that consumes this
  // object and quietly understate the relation count.
  // `deleted` is left at its default (`exclude`): a soft-deleted process is not a live relation, the
  // same reasoning the server applies to a soft-deleted flow, which never matches `?ref=` either.
  const page = await client.processes.list(
    {
      page: 1,
      size: RELATIONS_PAGE_SIZE,
      ref: objectId,
      direction,
      scope: 'all',
      full: true,
      enrichFiles: false,
      sort: '-createdAt',
    },
    { signal }
  )

  const bag = direction === 'input' ? 'inputs' : 'outputs'

  const relations = page.data.map((process) => {
    const flows = (process[bag] ?? []).filter((flow) => flow.ref === objectId)

    // The server matched this row BECAUSE a live flow on this side points at the object, so an empty
    // result contradicts the filter. Log it and keep the row: the relation is real even when its
    // detail cannot be located, and dropping it would under-report a relation with nothing to see.
    if (flows.length === 0) {
      logger.warn('Process matched ?ref= with no flow on the queried side', {
        processId: process.id,
        objectId,
        direction,
      })
    }

    return {
      process,
      flows: flows.map((flow) => ({
        id: flow.id,
        quantity: flowQuantity(flow),
      })),
    }
  })

  return { relations, total: page.page.totalElements }
}

export interface UseObjectRelationsResult {
  /** Processes taking this object as an INPUT. */
  consumedBy?: RelationGroup
  /** Processes producing this object as an OUTPUT. */
  producedBy?: RelationGroup
  isLoading: boolean
  error: Error | null
}

/**
 * Both sides are asked for separately rather than split client-side from one unfiltered `?ref=`
 * read. The server already knows which side matched, so re-deriving it here would be an inference
 * that can silently disagree — and two queries paginate each side on its own, so a heavily consumed
 * object cannot push every "produced by" row off the first page.
 */
export function useObjectRelations(
  objectId: string | undefined
): UseObjectRelationsResult {
  const client = useIomClient()

  const inputs = useQuery({
    queryKey: queryKeys.processes.relations(objectId ?? '', 'input'),
    queryFn: ({ signal }) => fetchRelations(client, objectId!, 'input', signal),
    enabled: !!objectId,
    staleTime: STALE_TIME,
  })

  const outputs = useQuery({
    queryKey: queryKeys.processes.relations(objectId ?? '', 'output'),
    queryFn: ({ signal }) =>
      fetchRelations(client, objectId!, 'output', signal),
    enabled: !!objectId,
    staleTime: STALE_TIME,
  })

  return {
    consumedBy: inputs.data,
    producedBy: outputs.data,
    isLoading: inputs.isLoading || outputs.isLoading,
    error: ((inputs.error ?? outputs.error) as Error | null) ?? null,
  }
}
