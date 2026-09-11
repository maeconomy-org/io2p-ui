'use client'

// Fetches the whole process flow graph from the processes list alone.
//
// A list row carries everything the chart needs: the flows (so the topology), their properties (so
// the quantities), and each flow's `refName` — the referenced object's name, resolved on read via
// one batched lookup per page. That last part is recent; before it, a name could only be had from
// the DETAIL read, so this hook had a second phase that fetched one process per visible node just to
// turn uuids into labels. The list flag removed the reason for it.
//
// Names cannot be resolved client-side, which is why the flag mattered: there is no `ids` filter on
// the objects list, and `refName` is deliberately name-only — a viewer with a shared process sees
// its input names WITHOUT read access to those objects (D75/C2), so `objects.get` would 404 exactly
// where it counts.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Io2pClient, ProcessListItem } from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { logger } from '@/lib/observability/logger'

import {
  buildProcessGraph,
  computeDepths,
  countLevels,
  limitDepth,
  limitDepthAround,
  narrowToObjects,
  removeCycles,
  sliceGraph,
  unitBreakdown,
  withDepths,
  type Edge,
  type GraphLink,
  type ProcessGraph,
} from '../utils/process-graph'

const GRAPH_PAGE_SIZE = 100

/**
 * Ceiling on the sweep. A graph past this is unreadable long before it is unfetchable, so the cap is
 * about the request budget, not the chart — and when it bites, `truncated` says so out loud rather
 * than quietly drawing a partial graph.
 */
const GRAPH_MAX_PAGES = 5

const STALE_TIME = 30_000

/**
 * Sweep every page of processes.
 *
 * The first page is what tells us how many there are, so it has to come back before the rest can be
 * asked for — but the rest go out TOGETHER. Chaining them made a cold load N round trips of dead
 * time behind a skeleton; this is two, whatever N is.
 */
async function fetchGraphProcesses(
  client: Io2pClient,
  signal?: AbortSignal
): Promise<{ processes: ProcessListItem[]; truncated: boolean }> {
  // `enrichFiles: false` — the chart draws no thumbnails, and this is the heaviest part of a row.
  // `refNames: true` is the server default, but stated anyway: the whole chart is labelled from it,
  // and if the default ever flipped the graph would quietly render uuids rather than fail.
  // `full: true` because a LEAN flow is a thin ref — `{id, ref, refName}` — and every link width
  // comes from the flow's own `quantity` property. Without it the Sankey draws, and draws wrong.
  const query = {
    size: GRAPH_PAGE_SIZE,
    scope: 'all' as const,
    enrichFiles: false,
    refNames: true,
    full: true,
  }

  const first = await client.processes.list({ page: 1, ...query }, { signal })
  const wanted = first.page.totalPages
  const fetching = Math.min(wanted, GRAPH_MAX_PAGES)

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, fetching - 1) }, (_, i) =>
      client.processes.list({ page: i + 2, ...query }, { signal })
    )
  )

  const processes = [...first.data, ...rest.flatMap((page) => page.data)]
  const truncated = wanted > GRAPH_MAX_PAGES

  if (truncated) {
    logger.warn('Process graph truncated', {
      fetched: processes.length,
      totalPages: wanted,
      maxPages: GRAPH_MAX_PAGES,
    })
  }

  return { processes, truncated }
}

export interface ProcessGraphWindow {
  /** First topological level shown. */
  from: number
  /** How many levels the slice spans. */
  size: number
}

export interface UseProcessGraphOptions {
  /** Null draws the whole graph. Ignored while `focus` is set — focus is its own slice. */
  window: ProcessGraphWindow | null
  /** Node id to centre on, showing `focusHops` steps in each direction. */
  focus?: string | null
  focusHops?: number
  /** Object ids to narrow to; a link survives if either end is selected. Empty means no filter. */
  highlightObjects?: string[]
  /**
   * Cut back edges so the graph can be laid out in layers. Required by the Sankey; the overview is
   * force-directed and KEEPS recirculation, which is one of the things it exists to show.
   */
  acyclic?: boolean
}

export interface UseProcessGraphResult {
  /** Ready to draw: windowed, name-resolved, acyclic, with columns pinned. */
  graph: ProcessGraph
  /** Flows that had to be cut to make the layout acyclic. Real data, not drawn. */
  cutLinks: GraphLink[]
  /** Levels in the WHOLE graph, so the pager knows how many slices exist. */
  totalLevels: number
  /** Nodes in the whole graph, for the "+N not shown" readout. */
  totalNodes: number
  /** Units present across every link, most common first. */
  units: Array<{ unit: string; count: number }>
  /** True when the process sweep hit its page cap and the graph is incomplete. */
  truncated: boolean
  isLoading: boolean
  error: Error | null
}

const EMPTY_GRAPH: ProcessGraph = { nodes: [], links: [] }

export function useProcessGraph({
  window,
  focus = null,
  focusHops = 2,
  highlightObjects = [],
  acyclic = true,
}: UseProcessGraphOptions): UseProcessGraphResult {
  const client = useIomClient()

  const listQuery = useQuery({
    queryKey: queryKeys.processes.graph(),
    queryFn: ({ signal }) => fetchGraphProcesses(client, signal),
    staleTime: STALE_TIME,
  })

  const processes = listQuery.data?.processes

  // Topology from the list rows alone. Depths are computed over the FULL graph so columns stay put
  // as the user pages slices, and so the pager's level count doesn't shift under it.
  //
  // They are computed over the ACYCLIC full graph, because that is what actually gets DRAWN. A node
  // inside a cycle has no topological depth, and a depthless node defeated the window twice over:
  // the base slice let it through (there is no depth to fall outside), and the chart could not pin
  // a column for it — so ECharts placed it by its own layout pass, and "5 levels" drew seven
  // columns. Measuring the graph we draw, rather than the one we hold, gives every node a depth.
  const topology = useMemo(() => {
    const full = buildProcessGraph(processes ?? [])
    const layoutEdges: Edge[] = removeCycles(full.links).acyclic.map(
      ({ source, target }) => ({ source, target })
    )
    return {
      full,
      layoutEdges,
      depths: computeDepths(layoutEdges),
      levels: countLevels(layoutEdges),
    }
  }, [processes])

  // Which nodes are on screen. Focus wins over the window: it is a different question ("what touches
  // this?") and answering it inside a depth slice would silently drop half the answer.
  const visible = useMemo(() => {
    if (topology.full.links.length === 0) return null
    // Focus walks the CYCLIC graph: "what touches this?" is a question about real flows, and a
    // circular one still connects two things even though the Sankey cannot draw it. The window
    // walks the acyclic one, because it is a question about columns.
    if (focus) {
      const edges: Edge[] = topology.full.links.map(({ source, target }) => ({
        source,
        target,
      }))
      return limitDepthAround(edges, focusHops, focus)
    }
    const edges = topology.layoutEdges
    if (window) {
      // Clamped HERE because this is the only place both numbers are known. The caller holds the
      // requested start but learns `levels` from this hook, so clamping there is circular — and a
      // graph that got shallower (a refetch, a filter) would otherwise leave the start past the end,
      // drawing an empty slice with both pager arrows disabled.
      const from = Math.min(
        window.from,
        Math.max(0, topology.levels - window.size)
      )
      return limitDepth(edges, window.size, from)
    }
    return null
  }, [topology, focus, focusHops, window])

  const result = useMemo(() => {
    if (topology.full.links.length === 0) {
      return { graph: EMPTY_GRAPH, cutLinks: [] as GraphLink[] }
    }

    let graph = visible ? sliceGraph(topology.full, visible) : topology.full

    if (highlightObjects.length > 0) {
      graph = narrowToObjects(graph, highlightObjects)
    }

    // Cut cycles last, so what gets reported as "not drawn" reflects the visible slice rather than
    // flows the window had already excluded.
    const cut = acyclic
      ? removeCycles(graph.links)
      : { acyclic: graph.links, removed: [] as GraphLink[] }

    return {
      graph: withDepths({ ...graph, links: cut.acyclic }, topology.depths),
      cutLinks: cut.removed,
    }
  }, [topology, visible, highlightObjects, acyclic])

  return {
    graph: result.graph,
    cutLinks: result.cutLinks,
    totalLevels: topology.levels,
    totalNodes: topology.full.nodes.length,
    units: useMemo(
      () => unitBreakdown(topology.full.links),
      [topology.full.links]
    ),
    truncated: listQuery.data?.truncated ?? false,
    isLoading: listQuery.isLoading,
    error: (listQuery.error as Error | null) ?? null,
  }
}
