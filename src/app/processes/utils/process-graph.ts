// The process flow graph: process list rows -> nodes + links, plus the layout maths the Sankey
// needs. Rows must be fetched with `?full=true` — a lean flow has no `properties`, so every link
// would be unweighted.
//
// Pure and DTO-shaped on the way in, chart-agnostic on the way out — the ECharts option is built in
// the view, so everything here is testable without a canvas.
//
// The model is the process-as-HUB-NODE: `inputs -> [Process] -> outputs`, which is what io2p-core
// designed for (D67: "the Sankey middle-node render pairs in/out at draw time", so no per-pair
// input->output mapping is stored). Drawing input material straight to output material instead cannot
// express a transformation where in != out — a single link carries ONE magnitude, so only a node can
// have a different in-sum and out-sum. It also turns N inputs x M outputs into N+M links.
//
// A consequence used throughout: the graph is BIPARTITE. A flow always joins an object to a process,
// so node kinds strictly alternate and every depth has a fixed parity.

import type { ProcessListItem } from 'io2p-client'

import { QUANTITY_KEY } from '@/lib/entity'

type ReadFlow = ProcessListItem['inputs'][number]

export type NodeKind = 'object' | 'process'

/** Only objects have a meaningful role; a process is always a hub. */
export type NodeRole = 'source' | 'intermediate' | 'sink' | 'hub'

export interface GraphNode {
  id: string
  kind: NodeKind
  /** Empty until a name is known — object names arrive only on the process DETAIL read. */
  name: string
  role: NodeRole
  /** Min-span column. Undefined for a node inside a cycle, which has no acyclic depth. */
  depth?: number
}

export interface GraphLink {
  source: string
  target: string
  flowId: string
  processId: string
  processName: string
  direction: 'input' | 'output'
  /** Canonical magnitude from the server normalizer. Absent when the quantity did not parse. */
  num?: number
  /** Canonical unit symbol, or `''` for a unitless number. Absent alongside `num`. */
  unit?: string
  /** The raw authored string, e.g. `"0.1 t"` — what the user typed, for display. */
  display?: string
  /** The quantity property's label, when it has one. */
  label?: string
}

export interface ProcessGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface Edge {
  source: string
  target: string
}

/**
 * A flow's quantity, read off the server-normalized value.
 *
 * io2p normalizes every value: `num` is the magnitude converted to its dimension's canonical unit
 * ("2 t" -> 2000), present iff `parse.ok`. So there is nothing to parse here — and because the
 * conversion is per dimension, two values are comparable exactly when their `unit` matches.
 */
export function flowQuantity(flow: ReadFlow): {
  num?: number
  unit?: string
  display?: string
  label?: string
} {
  const property = flow.properties?.find(
    (p) => p.key === QUANTITY_KEY && !p.deleted
  )
  const value = property?.values.find((v) => !v.deleted)
  if (!value) return {}

  return {
    ...(value.num !== undefined
      ? { num: value.num, unit: value.unit ?? '' }
      : {}),
    display: value.data,
    ...(property?.label ? { label: property.label } : {}),
  }
}

/**
 * Build the hub graph. Object nodes are deduplicated across processes — the same material feeding two
 * processes is ONE node, which is what makes a chain a chain.
 *
 * Pass a mix of list rows and detail rows freely: a name found on any flow wins, so an object named by
 * one process's detail read is named everywhere it appears.
 */
export function buildProcessGraph(processes: ProcessListItem[]): ProcessGraph {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  const nameObject = (ref: string, name: string | undefined) => {
    const existing = nodes.get(ref)
    if (!existing) {
      nodes.set(ref, {
        id: ref,
        kind: 'object',
        name: name ?? '',
        role: 'intermediate',
      })
      return
    }
    if (!existing.name && name) existing.name = name
  }

  for (const process of processes) {
    nodes.set(process.id, {
      id: process.id,
      kind: 'process',
      name: process.name,
      role: 'hub',
    })

    const bags = [
      { direction: 'input' as const, flows: process.inputs ?? [] },
      { direction: 'output' as const, flows: process.outputs ?? [] },
    ]

    for (const { direction, flows } of bags) {
      for (const flow of flows) {
        if (!flow.ref) continue
        nameObject(flow.ref, flow.refName)
        links.push({
          source: direction === 'input' ? flow.ref : process.id,
          target: direction === 'input' ? process.id : flow.ref,
          flowId: flow.id,
          processId: process.id,
          processName: process.name,
          direction,
          ...flowQuantity(flow),
        })
      }
    }
  }

  assignRoles(nodes, links)
  return { nodes: [...nodes.values()], links }
}

/** An object only ever consumed is a source, only ever produced is a sink, both is intermediate. */
function assignRoles(nodes: Map<string, GraphNode>, links: GraphLink[]): void {
  const consumed = new Set(links.map((l) => l.source))
  const produced = new Set(links.map((l) => l.target))

  for (const node of nodes.values()) {
    if (node.kind === 'process') continue
    const isProduced = produced.has(node.id)
    const isConsumed = consumed.has(node.id)
    node.role =
      isProduced && isConsumed ? 'intermediate' : isProduced ? 'sink' : 'source'
  }
}

/**
 * Column per node, chosen to MINIMISE edge length — every node sits next to the neighbours it connects
 * to, so no flow stretches across the whole chart.
 *
 * The rule: a node sits one column before its EARLIEST child (as late as it can go). Sinks, having no
 * children, anchor at their own `asap` (longest path from a source). Both halves are needed:
 *  - Source-justifying everything strands a leaf input whose only consumer is deep (a roof panel
 *    feeding the final building) alone at column 0.
 *  - Sink-justifying everything does the mirror, flinging an early-produced terminal to the far right.
 *
 * Short edges also mean a flow crossing a depth-window boundary stays inside one overlapping slice,
 * so it remains traceable while paging.
 *
 * Cycle-safe: a node inside a cycle never reaches in-degree 0, so it is never enqueued (no infinite
 * loop) and simply gets no depth — callers decide what to do with those.
 */
function computeNodeDepths(edges: Edge[]): {
  depth: Map<string, number>
  allIds: Set<string>
} {
  const children = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  const allIds = new Set<string>()

  for (const e of edges) {
    allIds.add(e.source)
    allIds.add(e.target)
  }
  for (const id of allIds) {
    children.set(id, new Set())
    inDegree.set(id, 0)
  }

  // Dedupe: two processes can share a source->target pair, and a double-counted in-degree would never
  // drain to 0, making an acyclic node look cyclic.
  const seen = new Set<string>()
  for (const e of edges) {
    const key = `${e.source} ${e.target}`
    if (seen.has(key) || e.source === e.target) continue
    seen.add(key)
    children.get(e.source)!.add(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // asap = longest path from a source, via forward Kahn. topoOrder records the finalize order.
  const asap = new Map<string, number>()
  const topoOrder: string[] = []
  const pending = new Map(inDegree)
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id)
      asap.set(id, 0)
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!
    topoOrder.push(current)
    const currentDepth = asap.get(current)!
    for (const child of children.get(current) ?? []) {
      if (currentDepth + 1 > (asap.get(child) ?? -1)) {
        asap.set(child, currentDepth + 1)
      }
      const remaining = (pending.get(child) ?? 0) - 1
      pending.set(child, remaining)
      if (remaining === 0) queue.push(child)
    }
  }

  // Walking topoOrder in REVERSE places every child before its parents, so a parent lands at
  // min(child) - 1 < every child. The layering stays valid (depth(parent) < depth(child)) and every
  // node keeps depth >= asap.
  const depth = new Map<string, number>()
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i]
    let earliestChild = Infinity
    for (const child of children.get(id) ?? []) {
      const childDepth = depth.get(child)
      if (childDepth !== undefined && childDepth < earliestChild) {
        earliestChild = childDepth
      }
    }
    depth.set(
      id,
      earliestChild === Infinity ? asap.get(id)! : earliestChild - 1
    )
  }

  return { depth, allIds }
}

/** Per-node column for the WHOLE graph, so the chart and the fetch window agree on what a level is. */
export function computeDepths(edges: Edge[]): Map<string, number> {
  if (edges.length === 0) return new Map()
  return computeNodeDepths(edges).depth
}

/**
 * How many topological levels the full graph has. Drives the depth pager, so it must be computed over
 * the whole graph, not the visible slice. Nodes with no depth (in a cycle) do not extend the range.
 */
export function countLevels(edges: Edge[]): number {
  if (edges.length === 0) return 0
  const { depth } = computeNodeDepths(edges)
  let max = 0
  for (const d of depth.values()) if (d > max) max = d
  return max + 1
}

/**
 * The node ids inside the depth window `[from, from + size)`.
 *
 * Only the base window includes nodes with no depth (isolated or in a cycle). Sliding deeper shows a
 * clean slice and must not re-pin those rootless nodes at every offset.
 */
export function limitDepth(edges: Edge[], size: number, from = 0): Set<string> {
  if (edges.length === 0) return new Set()
  const { depth, allIds } = computeNodeDepths(edges)

  const kept = new Set<string>()
  for (const [id, d] of depth) {
    if (d >= from && d < from + size) kept.add(id)
  }
  if (from === 0) {
    for (const id of allIds) if (!depth.has(id)) kept.add(id)
  }
  return kept
}

/**
 * The node ids within `hops` steps of `focus` in BOTH directions, focus in the middle.
 *
 * Under the bipartite hub model one hop crosses a node KIND, so `hops = 2` from an object reaches its
 * processes and their other materials — one full transformation each way.
 */
export function limitDepthAround(
  edges: Edge[],
  hops: number,
  focus: string
): Set<string> {
  if (edges.length === 0) return new Set()

  const forward = new Map<string, Set<string>>()
  const backward = new Map<string, Set<string>>()
  const known = new Set<string>()

  for (const e of edges) {
    known.add(e.source)
    known.add(e.target)
    if (!forward.has(e.source)) forward.set(e.source, new Set())
    if (!backward.has(e.target)) backward.set(e.target, new Set())
    forward.get(e.source)!.add(e.target)
    backward.get(e.target)!.add(e.source)
  }
  if (!known.has(focus)) return new Set()

  const kept = new Set<string>([focus])

  for (const adjacency of [forward, backward]) {
    const queue: Array<{ id: string; distance: number }> = [
      { id: focus, distance: 0 },
    ]
    const visited = new Set<string>([focus])
    while (queue.length > 0) {
      const { id, distance } = queue.shift()!
      if (distance >= hops) continue
      for (const next of adjacency.get(id) ?? []) {
        kept.add(next)
        if (!visited.has(next)) {
          visited.add(next)
          queue.push({ id: next, distance: distance + 1 })
        }
      }
    }
  }

  return kept
}

/**
 * Split links into a DAG plus the back edges that had to go.
 *
 * A Sankey is a layered acyclic layout — ECharts cannot place a cycle, so recirculation (an output fed
 * back as an input further up) has to be cut somewhere. The cut links are RETURNED, not dropped
 * silently: they are real data, and the view says how many were removed.
 *
 * Iterative DFS: a link into a node still on the stack is a back edge.
 */
export function removeCycles(links: GraphLink[]): {
  acyclic: GraphLink[]
  removed: GraphLink[]
} {
  const outgoing = new Map<string, number[]>()
  links.forEach((link, index) => {
    if (!outgoing.has(link.source)) outgoing.set(link.source, [])
    outgoing.get(link.source)!.push(index)
  })

  const ON_STACK = 1
  const DONE = 2
  const state = new Map<string, 1 | 2>()
  const cyclic = new Set<number>()

  const starts = new Set(links.flatMap((l) => [l.source, l.target]))
  for (const start of starts) {
    if (state.has(start)) continue
    state.set(start, ON_STACK)
    const stack: Array<{ id: string; next: number }> = [{ id: start, next: 0 }]

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const edges = outgoing.get(frame.id) ?? []
      if (frame.next >= edges.length) {
        state.set(frame.id, DONE)
        stack.pop()
        continue
      }
      const index = edges[frame.next++]
      const target = links[index].target
      if (target === frame.id) {
        cyclic.add(index)
        continue
      }
      const seen = state.get(target)
      if (seen === ON_STACK) {
        cyclic.add(index)
        continue
      }
      if (seen === DONE) continue
      state.set(target, ON_STACK)
      stack.push({ id: target, next: 0 })
    }
  }

  return {
    acyclic: links.filter((_, i) => !cyclic.has(i)),
    removed: links.filter((_, i) => cyclic.has(i)),
  }
}

/** How many flows touch each node. Drives node size in the overview: hubs should read as hubs. */
export function graphDegrees(links: GraphLink[]): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const link of links) {
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1)
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1)
  }
  return degrees
}

/** Undirected adjacency with edge identity, so a multigraph's parallel edges stay distinguishable. */
function undirectedAdjacency(
  links: GraphLink[]
): Map<string, Array<{ to: string; edge: number }>> {
  const adjacency = new Map<string, Array<{ to: string; edge: number }>>()
  const push = (from: string, to: string, edge: number) => {
    const list = adjacency.get(from)
    if (list) list.push({ to, edge })
    else adjacency.set(from, [{ to, edge }])
  }
  links.forEach((link, edge) => {
    push(link.source, link.target, edge)
    push(link.target, link.source, edge)
  })
  return adjacency
}

/**
 * Independent flow networks — sets of nodes with no path between them, ignoring direction.
 *
 * "Three separate networks" is a more useful thing to say about a graph than "twelve nodes": it tells
 * you whether the material chains you are looking at are actually related.
 */
export function connectedComponents(links: GraphLink[]): Map<string, number> {
  const adjacency = undirectedAdjacency(links)
  const component = new Map<string, number>()
  let index = 0

  for (const start of adjacency.keys()) {
    if (component.has(start)) continue
    const stack = [start]
    component.set(start, index)
    while (stack.length > 0) {
      const node = stack.pop()!
      for (const { to } of adjacency.get(node) ?? []) {
        if (component.has(to)) continue
        component.set(to, index)
        stack.push(to)
      }
    }
    index++
  }

  return component
}

/**
 * The flow ids whose removal would split the graph into more networks — bridges, via Tarjan.
 *
 * This is the overview's whole point. A bridge is the single link joining two otherwise-separate
 * chains: material leaving one building and entering another, the one place a recycled output
 * re-enters production. Everything else in a dense cluster is internal traffic. Cut a bridge and two
 * networks fall apart, which is exactly the dependency worth seeing.
 *
 * Iterative, because the recursive form dies on a long chain. Undirected and multigraph-safe: descent
 * is tracked by EDGE, not by parent node, so two parallel links between the same pair correctly
 * count as neither being a bridge.
 */
export function findBridges(links: GraphLink[]): Set<string> {
  const adjacency = undirectedAdjacency(links)
  const discovered = new Map<string, number>()
  const low = new Map<string, number>()
  const bridges = new Set<string>()
  let timer = 0

  for (const start of adjacency.keys()) {
    if (discovered.has(start)) continue
    discovered.set(start, timer)
    low.set(start, timer)
    timer++

    const stack: Array<{ node: string; viaEdge: number; next: number }> = [
      { node: start, viaEdge: -1, next: 0 },
    ]

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const edges = adjacency.get(frame.node) ?? []

      if (frame.next < edges.length) {
        const { to, edge } = edges[frame.next++]
        if (edge === frame.viaEdge) continue
        if (discovered.has(to)) {
          low.set(
            frame.node,
            Math.min(low.get(frame.node)!, discovered.get(to)!)
          )
          continue
        }
        discovered.set(to, timer)
        low.set(to, timer)
        timer++
        stack.push({ node: to, viaEdge: edge, next: 0 })
        continue
      }

      stack.pop()
      const parent = stack[stack.length - 1]
      if (!parent) continue
      low.set(
        parent.node,
        Math.min(low.get(parent.node)!, low.get(frame.node)!)
      )
      if (low.get(frame.node)! > discovered.get(parent.node)!) {
        bridges.add(links[frame.viaEdge].flowId)
      }
    }
  }

  return bridges
}

/**
 * Which units the graph's quantities are expressed in, most common first.
 *
 * A Sankey puts every link on ONE width scale, so `1000 kg` and `5 m3` drawn together make the widths
 * meaningless — and destroy the in-vs-out narrowing that is the entire point of the hub node. Because
 * the server converts each `num` to its dimension's canonical unit, matching `unit` IS matching
 * dimension, so this grouping needs no unit registry.
 *
 * `''` is the unitless bucket (a bare number). Links with no `num` appear in no bucket.
 */
export function unitBreakdown(
  links: GraphLink[]
): Array<{ unit: string; count: number }> {
  const counts = new Map<string, number>()
  for (const link of links) {
    if (link.num === undefined) continue
    const unit = link.unit ?? ''
    counts.set(unit, (counts.get(unit) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([unit, count]) => ({ unit, count }))
    .sort((a, b) => b.count - a.count || a.unit.localeCompare(b.unit))
}

/**
 * Narrow the graph to the processes the given objects take part in — WHOLE processes, not just the
 * chosen objects' own flows.
 *
 * Keeping only links that touch a selected object answers a narrower question than anyone asks. A
 * process is a transformation: "what happens to this material" is unreadable without the other
 * inputs it is combined with and the other outputs it yields. Filtering to one object's own two
 * flows draws `object -> process -> object` and hides the fact that three other materials went in.
 *
 * So this expands one hop: find the processes touched, then keep every flow of those processes. The
 * graph is bipartite (objects and processes alternate), so one hop from an object is exactly the set
 * of processes it participates in — no depth search needed.
 */
export function narrowToObjects(
  graph: ProcessGraph,
  objectIds: string[]
): ProcessGraph {
  const selected = new Set(objectIds)
  const isProcess = new Map(
    graph.nodes.map((n) => [n.id, n.kind === 'process'])
  )

  // Kind-checked rather than "the other end", so a process id passed in by mistake narrows to
  // nothing visible instead of quietly expanding to every process its objects touch.
  const touched = new Set<string>()
  for (const link of graph.links) {
    if (selected.has(link.source) && isProcess.get(link.target)) {
      touched.add(link.target)
    }
    if (selected.has(link.target) && isProcess.get(link.source)) {
      touched.add(link.source)
    }
  }

  const links = graph.links.filter(
    (l) => touched.has(l.source) || touched.has(l.target)
  )
  const connected = new Set(links.flatMap((l) => [l.source, l.target]))
  return { nodes: graph.nodes.filter((n) => connected.has(n.id)), links }
}

/**
 * Keep only the nodes in `keep`, and the links whose BOTH ends survive.
 *
 * Then drop nodes left with no link at all: a node kept by the depth window whose only edges reach
 * outside it would otherwise float unconnected, which reads as a data error rather than a boundary.
 */
export function sliceGraph(
  graph: ProcessGraph,
  keep: Set<string>
): ProcessGraph {
  const links = graph.links.filter(
    (l) => keep.has(l.source) && keep.has(l.target)
  )
  const connected = new Set(links.flatMap((l) => [l.source, l.target]))
  return {
    nodes: graph.nodes.filter((n) => connected.has(n.id)),
    links,
  }
}

/** Attach each node's column so the chart pins it rather than re-deriving a layout. */
export function withDepths(
  graph: ProcessGraph,
  depths: Map<string, number>
): ProcessGraph {
  return {
    nodes: graph.nodes.map((node) => {
      const depth = depths.get(node.id)
      return depth === undefined ? node : { ...node, depth }
    }),
    links: graph.links,
  }
}
