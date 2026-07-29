'use client'

// Fetches the process flow graph in TWO phases, because of one asymmetry in the API:
//
//   `refName` — the object's name on a flow — is populated ONLY on the detail read
//   (`processes.service.ts` calls `enrichRefNames()` in `get(id)`, not in `list()`).
//
// You cannot resolve those names yourself: there is no `ids` filter on the objects list, and
// `refName` is deliberately name-only — a viewer with a shared process sees its input names WITHOUT
// read access to the objects (D75/C2), so `objects.get` would 404 exactly where it matters.
//
// So: phase 1 lists every process for TOPOLOGY and quantities (flows and their properties DO come on
// list rows), and phase 2 reads details only for the processes actually on screen, purely for names.
// This is the old hook's own principle — compute depth from edges first, fetch only the window —
// and it is cheaper now that the edges arrive with the list.

import { useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import type { Io2pClient, ProcessDTO } from 'io2p-client'

import { useIomClient } from '@/lib/io2p'
import { queryKeys } from '@/lib/query-keys'
import { logger } from '@/lib'

import {
  buildProcessGraph,
  computeDepths,
  countLevels,
  limitDepth,
  limitDepthAround,
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

async function fetchGraphProcesses(
  client: Io2pClient
): Promise<{ processes: ProcessDTO[]; truncated: boolean }> {
  const processes: ProcessDTO[] = []

  for (let page = 1; page <= GRAPH_MAX_PAGES; page++) {
    // `enrichFiles: false` — the chart draws no thumbnails, and this is the heaviest part of a row.
    const result = await client.processes.list({
      page,
      size: GRAPH_PAGE_SIZE,
      scope: 'all',
      enrichFiles: false,
    })
    processes.push(...result.data)
    if (page >= result.page.totalPages) {
      return { processes, truncated: false }
    }
  }

  logger.warn('Process graph truncated', {
    fetched: processes.length,
    maxPages: GRAPH_MAX_PAGES,
  })
  return { processes, truncated: true }
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
  /** True while names for the current slice are still arriving. */
  isResolvingNames: boolean
  error: Error | null
}

const EMPTY_GRAPH: ProcessGraph = { nodes: [], links: [] }

export function useProcessGraph({
  window,
  focus = null,
  focusHops = 2,
  highlightObjects = [],
}: UseProcessGraphOptions): UseProcessGraphResult {
  const client = useIomClient()

  const listQuery = useQuery({
    queryKey: queryKeys.processes.graph(),
    queryFn: () => fetchGraphProcesses(client),
    staleTime: STALE_TIME,
  })

  const processes = listQuery.data?.processes

  // Topology from the list rows alone. Depths are computed over the FULL graph so columns stay put
  // as the user pages slices, and so the pager's level count doesn't shift under it.
  const topology = useMemo(() => {
    const full = buildProcessGraph(processes ?? [])
    const edges: Edge[] = full.links.map(({ source, target }) => ({
      source,
      target,
    }))
    return { full, depths: computeDepths(edges), levels: countLevels(edges) }
  }, [processes])

  // Which nodes are on screen. Focus wins over the window: it is a different question ("what touches
  // this?") and answering it inside a depth slice would silently drop half the answer.
  const visible = useMemo(() => {
    const edges: Edge[] = topology.full.links.map(({ source, target }) => ({
      source,
      target,
    }))
    if (edges.length === 0) return null
    if (focus) return limitDepthAround(edges, focusHops, focus)
    if (window) return limitDepth(edges, window.size, window.from)
    return null
  }, [topology, focus, focusHops, window])

  // Phase 2: names, for the processes actually on screen. `enrichFiles: false` keeps the payload to
  // what this needs and gives it a cache entry of its own, so it can never serve thin files to the
  // sheet (which asks for enriched ones).
  const visibleProcessIds = useMemo(() => {
    const ids = topology.full.nodes
      .filter((n) => n.kind === 'process')
      .filter((n) => !visible || visible.has(n.id))
      .map((n) => n.id)
    return ids
  }, [topology, visible])

  const detailQueries = useQueries({
    queries: visibleProcessIds.map((id) => ({
      queryKey: [...queryKeys.processes.detail(id), 'thinFiles'],
      queryFn: () => client.processes.get(id, { enrichFiles: false }),
      staleTime: STALE_TIME,
    })),
  })

  // `useQueries` returns a fresh array every render, so keying the map on it would mint a new Map
  // each time and rebuild the whole graph below. Which reads have RESOLVED is what actually changes
  // the names, so that is what the memo depends on.
  const resolvedSignature = detailQueries
    .map((q) => ((q.data as ProcessDTO | undefined)?.id ? '1' : '0'))
    .join('')

  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const query of detailQueries) {
      const dto = query.data as ProcessDTO | undefined
      if (!dto) continue
      for (const flow of [...(dto.inputs ?? []), ...(dto.outputs ?? [])]) {
        if (flow.refName) map.set(flow.ref, flow.refName)
      }
    }
    return map
  }, [resolvedSignature])

  const result = useMemo(() => {
    if (topology.full.links.length === 0) {
      return { graph: EMPTY_GRAPH, cutLinks: [] as GraphLink[] }
    }

    let graph = visible ? sliceGraph(topology.full, visible) : topology.full

    if (highlightObjects.length > 0) {
      const selected = new Set(highlightObjects)
      const links = graph.links.filter(
        (l) => selected.has(l.source) || selected.has(l.target)
      )
      const connected = new Set(links.flatMap((l) => [l.source, l.target]))
      graph = { nodes: graph.nodes.filter((n) => connected.has(n.id)), links }
    }

    // Cut cycles last, so what gets reported as "not drawn" reflects the visible slice rather than
    // flows the window had already excluded.
    const { acyclic, removed } = removeCycles(graph.links)
    const named = {
      nodes: graph.nodes.map((node) =>
        node.name ? node : { ...node, name: names.get(node.id) ?? '' }
      ),
      links: acyclic,
    }

    return { graph: withDepths(named, topology.depths), cutLinks: removed }
  }, [topology, visible, highlightObjects, names])

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
    isResolvingNames: detailQueries.some((q) => q.isLoading),
    error: (listQuery.error as Error | null) ?? null,
  }
}
