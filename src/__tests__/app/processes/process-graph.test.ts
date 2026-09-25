import { describe, it, expect } from 'vitest'
import type { ProcessDTO } from 'io2p-client'

import {
  buildProcessGraph,
  computeDepths,
  connectedComponents,
  countLevels,
  findBridges,
  flowQuantity,
  graphDegrees,
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
} from '@/app/processes/utils/process-graph'
import { QUANTITY_KEY } from '@/lib/entity'

// ── fixtures ──────────────────────────────────────────────────────────────────

let flowSeq = 0

function flow(
  ref: string,
  quantity?: string,
  over: Record<string, unknown> = {}
) {
  flowSeq += 1
  return {
    id: `flow-${flowSeq}`,
    ref,
    refName: ref === 'unnamed' ? undefined : `Name of ${ref}`,
    properties: quantity
      ? [
          {
            id: `p-${flowSeq}`,
            key: QUANTITY_KEY,
            values: [quantityValue(quantity)],
          },
        ]
      : [],
    ...over,
  }
}

/** Mirrors the server normalizer: `num` is canonical and present only when the value parsed. */
function quantityValue(data: string) {
  const match = /^(-?[\d.]+)\s*(\S+)?$/.exec(data)
  if (!match) return { id: 'v', data, source: 'authored' as const }
  const [, digits, unit] = match
  return {
    id: 'v',
    data,
    source: 'authored' as const,
    num: Number(digits),
    ...(unit ? { unit } : {}),
    parse: { ok: true, normVersion: 1 },
  }
}

function process(
  id: string,
  name: string,
  inputs: ReturnType<typeof flow>[],
  outputs: ReturnType<typeof flow>[]
): ProcessDTO {
  return {
    id,
    name,
    currentVersion: 1,
    properties: [],
    inputs,
    outputs,
  } as unknown as ProcessDTO
}

/** Scrap + Ore -> [Smelt] -> Billet -> [Roll] -> Rebar. Two chained transformations. */
function chain(): ProcessDTO[] {
  flowSeq = 0
  return [
    process(
      'smelt',
      'Smelt',
      [flow('scrap', '800 kg'), flow('ore', '400 kg')],
      [flow('billet', '1000 kg')]
    ),
    process(
      'roll',
      'Roll',
      [flow('billet', '1000 kg')],
      [flow('rebar', '950 kg')]
    ),
  ]
}

const edgesOf = (links: GraphLink[]): Edge[] =>
  links.map(({ source, target }) => ({ source, target }))

// ── buildProcessGraph ─────────────────────────────────────────────────────────

describe('buildProcessGraph', () => {
  it('models the process as a hub node, not input->output links', () => {
    const { nodes, links } = buildProcessGraph([
      process(
        'smelt',
        'Smelt',
        [flow('scrap', '800 kg'), flow('ore', '400 kg')],
        [flow('billet', '1000 kg')]
      ),
    ])

    // 2 inputs x 1 output would be 2 links either way; the point is that they route THROUGH the
    // process node rather than joining materials directly.
    expect(nodes.find((n) => n.id === 'smelt')?.kind).toBe('process')
    expect(links.map((l) => `${l.source}->${l.target}`)).toEqual([
      'scrap->smelt',
      'ore->smelt',
      'smelt->billet',
    ])
    expect(
      links.some((l) => l.source === 'scrap' && l.target === 'billet')
    ).toBe(false)
  })

  it('collapses the N x M edge explosion to N + M', () => {
    flowSeq = 0
    const { links } = buildProcessGraph([
      process(
        'p',
        'Wide',
        [flow('a'), flow('b'), flow('c')],
        [flow('x'), flow('y'), flow('z')]
      ),
    ])

    expect(links).toHaveLength(6) // 3 + 3, not 3 x 3
  })

  it('deduplicates an object shared by two processes into one node', () => {
    const { nodes } = buildProcessGraph(chain())

    expect(nodes.filter((n) => n.id === 'billet')).toHaveLength(1)
    expect(nodes.map((n) => n.id).sort()).toEqual([
      'billet',
      'ore',
      'rebar',
      'roll',
      'scrap',
      'smelt',
    ])
  })

  it('takes an object name from whichever flow has one', () => {
    flowSeq = 0
    // The list read omits refName; only the detail read carries it. A graph mixing both must still
    // end up with the name.
    const listRow = process(
      'p1',
      'From list',
      [flow('shared', undefined, { refName: undefined })],
      [flow('out')]
    )
    const detailRow = process(
      'p2',
      'From detail',
      [flow('shared')],
      [flow('other')]
    )

    const { nodes } = buildProcessGraph([listRow, detailRow])

    expect(nodes.find((n) => n.id === 'shared')?.name).toBe('Name of shared')
  })

  it('leaves the name empty rather than substituting the uuid', () => {
    flowSeq = 0
    const { nodes } = buildProcessGraph([
      process('p', 'P', [flow('unnamed')], [flow('out')]),
    ])

    expect(nodes.find((n) => n.id === 'unnamed')?.name).toBe('')
  })

  it('classifies object roles from the graph, and every process as a hub', () => {
    const { nodes } = buildProcessGraph(chain())
    const roleOf = (id: string) => nodes.find((n) => n.id === id)?.role

    expect(roleOf('scrap')).toBe('source')
    expect(roleOf('billet')).toBe('intermediate')
    expect(roleOf('rebar')).toBe('sink')
    expect(roleOf('smelt')).toBe('hub')
  })

  it('skips a flow with no ref instead of minting an empty node', () => {
    flowSeq = 0
    const { nodes, links } = buildProcessGraph([
      process('p', 'P', [flow('')], [flow('out')]),
    ])

    expect(links).toHaveLength(1)
    expect(nodes.map((n) => n.id)).not.toContain('')
  })

  it('allows the same object as both an input and an output (recirculation is legal)', () => {
    flowSeq = 0
    // D72 dropped key-uniqueness and nothing constrains a repeated ref; rework loops are real.
    const { nodes, links } = buildProcessGraph([
      process(
        'rework',
        'Rework',
        [flow('panel', '10 kg')],
        [flow('panel', '9 kg')]
      ),
    ])

    expect(nodes.filter((n) => n.id === 'panel')).toHaveLength(1)
    expect(links).toHaveLength(2)
  })
})

// ── flowQuantity ──────────────────────────────────────────────────────────────

describe('flowQuantity', () => {
  it('reads the canonical number the server normalized, not the raw string', () => {
    flowSeq = 0
    const f = flow('x', '0.1 t')
    f.properties[0].values[0] = {
      id: 'v',
      data: '0.1 t',
      source: 'authored' as const,
      num: 100, // canonicalized to kg by the node
      unit: 'kg',
      parse: { ok: true, normVersion: 1 },
    }

    expect(flowQuantity(f)).toMatchObject({
      num: 100,
      unit: 'kg',
      display: '0.1 t', // what the user typed survives for display
    })
  })

  it('returns nothing for a flow with no quantity property', () => {
    flowSeq = 0
    expect(flowQuantity(flow('x'))).toEqual({})
  })

  it('keeps the display string but omits num when the value did not parse', () => {
    flowSeq = 0
    const f = flow('x', 'a few')
    f.properties[0].values[0] = {
      id: 'v',
      data: 'a few',
      source: 'authored' as const,
      parse: { ok: false, normVersion: 1, reason: 'no-number' },
    } as never

    const result = flowQuantity(f)
    expect(result.display).toBe('a few')
    expect(result.num).toBeUndefined()
  })

  it('treats a bare number as unitless rather than dropping it', () => {
    flowSeq = 0
    expect(flowQuantity(flow('x', '12'))).toMatchObject({ num: 12, unit: '' })
  })

  it('ignores a soft-deleted quantity property', () => {
    flowSeq = 0
    const f = flow('x', '5 kg')
    f.properties[0] = { ...f.properties[0], deleted: true } as never

    expect(flowQuantity(f)).toEqual({})
  })
})

// ── depths ────────────────────────────────────────────────────────────────────

describe('computeDepths', () => {
  it('lays the bipartite chain out in alternating columns', () => {
    const { links } = buildProcessGraph(chain())
    const depths = computeDepths(edgesOf(links))

    expect(depths.get('scrap')).toBe(0)
    expect(depths.get('smelt')).toBe(1)
    expect(depths.get('billet')).toBe(2)
    expect(depths.get('roll')).toBe(3)
    expect(depths.get('rebar')).toBe(4)
  })

  it('pulls a source next to its consumer rather than stranding it at column 0', () => {
    // `ore` feeds only the deep process, so source-justifying would leave it far from `late`.
    const edges: Edge[] = [
      { source: 'a', target: 'p1' },
      { source: 'p1', target: 'b' },
      { source: 'b', target: 'p2' },
      { source: 'ore', target: 'p2' },
      { source: 'p2', target: 'c' },
    ]
    const depths = computeDepths(edges)

    expect(depths.get('p2')).toBe(3)
    expect(depths.get('ore')).toBe(2) // adjacent to p2, not at 0
  })

  it('anchors an early-produced terminal next to its producer', () => {
    // The mirror failure: sink-justifying everything flings `slag` to the far right column.
    const edges: Edge[] = [
      { source: 'a', target: 'p1' },
      { source: 'p1', target: 'slag' },
      { source: 'p1', target: 'b' },
      { source: 'b', target: 'p2' },
      { source: 'p2', target: 'c' },
    ]
    const depths = computeDepths(edges)

    expect(depths.get('slag')).toBe(2)
    expect(depths.get('c')).toBe(4)
  })

  it('keeps every parent strictly before every child', () => {
    const { links } = buildProcessGraph(chain())
    const depths = computeDepths(edgesOf(links))

    for (const link of links) {
      expect(depths.get(link.source)!).toBeLessThan(depths.get(link.target)!)
    }
  })

  it('survives a duplicate edge without treating the node as cyclic', () => {
    // Two processes can share a source->target pair; a double-counted in-degree would never drain.
    const edges: Edge[] = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]
    const depths = computeDepths(edges)

    expect(depths.get('c')).toBeDefined()
  })

  it('terminates on a cycle, leaving its nodes without a depth', () => {
    const depths = computeDepths([
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ])

    expect(depths.has('a')).toBe(false)
  })

  it('returns an empty map for an empty graph', () => {
    expect(computeDepths([]).size).toBe(0)
  })
})

describe('countLevels', () => {
  it('counts levels, not the largest index', () => {
    const { links } = buildProcessGraph(chain())
    expect(countLevels(edgesOf(links))).toBe(5)
  })

  it('is 0 for an empty graph', () => {
    expect(countLevels([])).toBe(0)
  })
})

// ── windowing ─────────────────────────────────────────────────────────────────

describe('limitDepth', () => {
  it('keeps only the nodes inside the window', () => {
    const { links } = buildProcessGraph(chain())
    const kept = limitDepth(edgesOf(links), 3, 0)

    expect([...kept].sort()).toEqual(['ore', 'scrap', 'smelt', 'billet'].sort())
  })

  it('slides deeper without re-including the roots', () => {
    const { links } = buildProcessGraph(chain())
    const kept = limitDepth(edgesOf(links), 3, 2)

    expect([...kept].sort()).toEqual(['billet', 'rebar', 'roll'])
    expect(kept.has('scrap')).toBe(false)
  })

  it('overlaps consecutive slices by one level so a crossing flow stays traceable', () => {
    // The pager steps by size - 1. `billet` is the right edge of slice 1 and the left edge of
    // slice 2, so smelt->billet and billet->roll are each fully drawn on one page.
    const { links } = buildProcessGraph(chain())
    const first = limitDepth(edgesOf(links), 3, 0)
    const second = limitDepth(edgesOf(links), 3, 2)

    expect([...first].filter((id) => second.has(id))).toEqual(['billet'])
  })

  it('includes cycle nodes in the base window only', () => {
    const edges: Edge[] = [
      { source: 'a', target: 'b' },
      { source: 'x', target: 'y' },
      { source: 'y', target: 'x' },
    ]

    expect(limitDepth(edges, 2, 0).has('x')).toBe(true)
    expect(limitDepth(edges, 2, 1).has('x')).toBe(false)
  })
})

describe('limitDepthAround', () => {
  it('reaches both upstream and downstream from the focus', () => {
    const { links } = buildProcessGraph(chain())
    const kept = limitDepthAround(edgesOf(links), 1, 'smelt')

    expect([...kept].sort()).toEqual(['billet', 'ore', 'scrap', 'smelt'])
  })

  it('crosses a whole transformation at two hops, since kinds alternate', () => {
    const { links } = buildProcessGraph(chain())
    const kept = limitDepthAround(edgesOf(links), 2, 'billet')

    expect(kept.has('scrap')).toBe(true) // billet <- smelt <- scrap
    expect(kept.has('rebar')).toBe(true) // billet -> roll -> rebar
  })

  it('returns nothing when the focus is not in the graph', () => {
    const { links } = buildProcessGraph(chain())
    expect(limitDepthAround(edgesOf(links), 2, 'ghost').size).toBe(0)
  })

  it('terminates on a cycle through the focus', () => {
    const kept = limitDepthAround(
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' },
      ],
      5,
      'a'
    )

    expect([...kept].sort()).toEqual(['a', 'b'])
  })
})

// ── cycles ────────────────────────────────────────────────────────────────────

describe('removeCycles', () => {
  const link = (source: string, target: string): GraphLink => ({
    source,
    target,
    flowId: `${source}-${target}`,
    processId: 'p',
    processName: 'P',
    direction: 'input',
  })

  it('leaves an acyclic graph untouched', () => {
    const links = [link('a', 'b'), link('b', 'c')]
    const { acyclic, removed } = removeCycles(links)

    expect(acyclic).toHaveLength(2)
    expect(removed).toHaveLength(0)
  })

  it('cuts exactly one link to break a cycle', () => {
    const { acyclic, removed } = removeCycles([
      link('a', 'b'),
      link('b', 'c'),
      link('c', 'a'),
    ])

    expect(removed).toHaveLength(1)
    expect(acyclic).toHaveLength(2)
  })

  it('returns the cut links rather than discarding them', () => {
    // They are real flows; the view reports how many it could not draw.
    const { removed } = removeCycles([link('a', 'b'), link('b', 'a')])

    expect(removed[0]).toMatchObject({ flowId: expect.any(String) })
  })

  it('cuts a self-loop', () => {
    const { acyclic, removed } = removeCycles([link('a', 'a')])

    expect(acyclic).toHaveLength(0)
    expect(removed).toHaveLength(1)
  })

  it('leaves a diamond intact — a shared descendant is not a cycle', () => {
    const { removed } = removeCycles([
      link('a', 'b'),
      link('a', 'c'),
      link('b', 'd'),
      link('c', 'd'),
    ])

    expect(removed).toHaveLength(0)
  })

  it('handles a long chain without recursing', () => {
    // The old implementation was recursive; a deep chain is exactly what would blow the stack.
    const links = Array.from({ length: 5000 }, (_, i) =>
      link(`n${i}`, `n${i + 1}`)
    )

    expect(() => removeCycles(links)).not.toThrow()
    expect(removeCycles(links).removed).toHaveLength(0)
  })

  it('produces a graph that has depths for every node', () => {
    // The contract the Sankey depends on: after cutting, the layering succeeds.
    const links = [link('a', 'b'), link('b', 'c'), link('c', 'a')]
    const { acyclic } = removeCycles(links)
    const depths = computeDepths(edgesOf(acyclic))

    for (const l of acyclic) {
      expect(depths.get(l.source)).toBeDefined()
      expect(depths.get(l.target)).toBeDefined()
    }
  })
})

// ── units ─────────────────────────────────────────────────────────────────────

describe('unitBreakdown', () => {
  it('groups by canonical unit, most common first', () => {
    flowSeq = 0
    const { links } = buildProcessGraph([
      process(
        'p',
        'P',
        [flow('a', '10 kg'), flow('b', '5 kg')],
        [flow('c', '2 m3')]
      ),
    ])

    expect(unitBreakdown(links)).toEqual([
      { unit: 'kg', count: 2 },
      { unit: 'm3', count: 1 },
    ])
  })

  it('ignores links with no parseable quantity', () => {
    flowSeq = 0
    const { links } = buildProcessGraph([
      process('p', 'P', [flow('a', '10 kg')], [flow('b')]),
    ])

    expect(unitBreakdown(links)).toEqual([{ unit: 'kg', count: 1 }])
  })

  it('buckets unitless numbers separately from any unit', () => {
    flowSeq = 0
    const { links } = buildProcessGraph([
      process('p', 'P', [flow('a', '10 kg')], [flow('b', '3')]),
    ])

    expect(unitBreakdown(links)).toContainEqual({ unit: '', count: 1 })
  })

  it('is empty when nothing carries a quantity', () => {
    flowSeq = 0
    const { links } = buildProcessGraph([
      process('p', 'P', [flow('a')], [flow('b')]),
    ])

    expect(unitBreakdown(links)).toEqual([])
  })
})

// ── narrowing ─────────────────────────────────────────────────────────────────

describe('narrowToObjects', () => {
  const ids = (graph: ProcessGraph) => graph.nodes.map((n) => n.id).sort()

  it('keeps the WHOLE process, not just the chosen object’s own flows', () => {
    // Scrap + Ore -> [Smelt] -> Billet. Narrowing to scrap must still show ore, because "what
    // happens to this material" is unreadable without what it was combined with.
    const narrowed = narrowToObjects(buildProcessGraph(chain()), ['scrap'])

    expect(ids(narrowed)).toEqual(['billet', 'ore', 'scrap', 'smelt'])
  })

  it('does not reach past the processes the object takes part in', () => {
    // Billet feeds Roll, but scrap never touches Roll — so rebar stays out.
    const narrowed = narrowToObjects(buildProcessGraph(chain()), ['scrap'])

    expect(narrowed.nodes.map((n) => n.id)).not.toContain('rebar')
    expect(narrowed.nodes.map((n) => n.id)).not.toContain('roll')
  })

  it('spans both processes for an object that sits between them', () => {
    const narrowed = narrowToObjects(buildProcessGraph(chain()), ['billet'])

    expect(ids(narrowed)).toEqual([
      'billet',
      'ore',
      'rebar',
      'roll',
      'scrap',
      'smelt',
    ])
  })

  it('unions the processes when several objects are chosen', () => {
    const narrowed = narrowToObjects(buildProcessGraph(chain()), [
      'scrap',
      'rebar',
    ])

    expect(ids(narrowed)).toEqual([
      'billet',
      'ore',
      'rebar',
      'roll',
      'scrap',
      'smelt',
    ])
  })

  it('narrows to nothing for an object in no process', () => {
    const narrowed = narrowToObjects(buildProcessGraph(chain()), ['stranger'])

    expect(narrowed.nodes).toEqual([])
    expect(narrowed.links).toEqual([])
  })

  // The kind check earns its keep here: without it a process id would expand through its own
  // objects to every process those objects touch — quietly showing MORE than was asked for.
  it('ignores a process id passed in place of an object', () => {
    const narrowed = narrowToObjects(buildProcessGraph(chain()), ['smelt'])

    expect(narrowed.nodes).toEqual([])
  })
})

// ── slicing ───────────────────────────────────────────────────────────────────

describe('sliceGraph', () => {
  it('drops links that leave the window', () => {
    const graph = buildProcessGraph(chain())
    const kept = limitDepth(edgesOf(graph.links), 3, 0)
    const sliced = sliceGraph(graph, kept)

    expect(
      sliced.links.every((l) => kept.has(l.source) && kept.has(l.target))
    ).toBe(true)
    expect(sliced.links.some((l) => l.target === 'roll')).toBe(false)
  })

  it('drops a node left with no visible link', () => {
    // Kept by depth, but its only edges point outside the slice — it would float unconnected.
    const graph = buildProcessGraph(chain())
    const sliced = sliceGraph(
      graph,
      new Set(['scrap', 'smelt', 'billet', 'roll'])
    )

    expect(sliced.nodes.map((n) => n.id)).not.toContain('ore')
  })

  it('returns an empty graph when nothing is kept', () => {
    const graph = buildProcessGraph(chain())
    expect(sliceGraph(graph, new Set())).toEqual({ nodes: [], links: [] })
  })
})

describe('withDepths', () => {
  it('pins a column on every node that has one', () => {
    const graph = buildProcessGraph(chain())
    const pinned = withDepths(graph, computeDepths(edgesOf(graph.links)))

    expect(pinned.nodes.find((n) => n.id === 'scrap')?.depth).toBe(0)
    expect(pinned.nodes.find((n) => n.id === 'rebar')?.depth).toBe(4)
  })

  it('leaves a node with no depth unpinned so the chart can place it', () => {
    const graph = buildProcessGraph(chain())
    const pinned = withDepths(graph, new Map([['scrap', 0]]))

    expect(pinned.nodes.find((n) => n.id === 'rebar')?.depth).toBeUndefined()
  })
})

// ── overview: degrees, networks, bridges ──────────────────────────────────────

const edge = (source: string, target: string, flowId?: string): GraphLink => ({
  source,
  target,
  flowId: flowId ?? `${source}-${target}`,
  processId: 'p',
  processName: 'P',
  direction: 'input',
})

describe('graphDegrees', () => {
  it('counts every flow touching a node, in either direction', () => {
    const degrees = graphDegrees([
      edge('a', 'hub'),
      edge('b', 'hub'),
      edge('hub', 'c'),
    ])

    expect(degrees.get('hub')).toBe(3)
    expect(degrees.get('a')).toBe(1)
  })

  it('counts parallel flows between the same pair separately', () => {
    // Two flows can legitimately point at the same object; the node really is busier.
    const degrees = graphDegrees([edge('a', 'b', 'f1'), edge('a', 'b', 'f2')])

    expect(degrees.get('a')).toBe(2)
  })

  it('is empty for a graph with no links', () => {
    expect(graphDegrees([]).size).toBe(0)
  })
})

describe('connectedComponents', () => {
  it('separates chains with no path between them', () => {
    const components = connectedComponents([
      edge('a', 'b'),
      edge('b', 'c'),
      edge('x', 'y'),
    ])

    expect(components.get('a')).toBe(components.get('c'))
    expect(components.get('a')).not.toBe(components.get('x'))
    expect(new Set(components.values()).size).toBe(2)
  })

  it('treats direction as irrelevant — a shared sink still joins two chains', () => {
    const components = connectedComponents([edge('a', 'z'), edge('b', 'z')])

    expect(new Set(components.values()).size).toBe(1)
  })

  it('is empty for a graph with no links', () => {
    expect(connectedComponents([]).size).toBe(0)
  })
})

describe('findBridges', () => {
  it('finds the single link joining two otherwise-separate chains', () => {
    // The overview's whole purpose: material leaving one building and entering another.
    const bridges = findBridges([
      edge('a1', 'a2'),
      edge('a2', 'a3'),
      edge('a3', 'a1'), // building A: a cycle, internally redundant
      edge('a3', 'b1', 'reuse'), // the handover
      edge('b1', 'b2'),
      edge('b2', 'b3'),
      edge('b3', 'b1'), // building B: also a cycle
    ])

    expect(bridges.has('reuse')).toBe(true)
  })

  it('calls no link in a cycle a bridge', () => {
    const bridges = findBridges([
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
    ])

    expect(bridges.size).toBe(0)
  })

  it('calls every link in a plain chain a bridge', () => {
    const bridges = findBridges([edge('a', 'b'), edge('b', 'c')])

    expect(bridges.size).toBe(2)
  })

  it('does not count either of two parallel links between the same pair', () => {
    // Multigraph-safe: descent is tracked by EDGE, not by parent node. Tracking the parent node
    // would make the second link look like a way back and mark both as bridges.
    const bridges = findBridges([edge('a', 'b', 'f1'), edge('a', 'b', 'f2')])

    expect(bridges.size).toBe(0)
  })

  it('reports the flow id, so the chart can style that exact flow', () => {
    const bridges = findBridges([edge('a', 'b', 'the-flow')])

    expect([...bridges]).toEqual(['the-flow'])
  })

  it('handles several independent networks in one pass', () => {
    const bridges = findBridges([edge('a', 'b', 'a-b'), edge('x', 'y', 'x-y')])

    expect(bridges).toEqual(new Set(['a-b', 'x-y']))
  })

  it('handles a long chain without recursing', () => {
    const links = Array.from({ length: 5000 }, (_, i) =>
      edge(`n${i}`, `n${i + 1}`, `f${i}`)
    )

    expect(findBridges(links).size).toBe(5000)
  })

  it('is empty for a graph with no links', () => {
    expect(findBridges([]).size).toBe(0)
  })
})

/**
 * The Sankey draws the ACYCLIC graph, so the window has to be measured on the acyclic graph too.
 *
 * A node inside a cycle has no topological depth. Measured on the cyclic graph it defeated the
 * window twice: `limitDepth` let it through at `from: 0` (no depth means no depth to fall outside)
 * and `withDepths` could not pin it a column, so ECharts placed it by its own layout pass. A
 * 5-level window drew seven columns.
 */
describe('windowing a graph that contains a cycle', () => {
  // a → b → c → d → e → f → g, with a cycle x ⇄ y hanging off b.
  const cyclic: Edge[] = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
    { source: 'd', target: 'e' },
    { source: 'e', target: 'f' },
    { source: 'f', target: 'g' },
    { source: 'b', target: 'x' },
    { source: 'x', target: 'y' },
    { source: 'y', target: 'x' },
  ]

  const acyclicOf = (edges: Edge[]): Edge[] =>
    removeCycles(edges.map((e) => edge(e.source, e.target))).acyclic.map(
      ({ source, target }) => ({ source, target })
    )

  it('leaves cycle members depthless when measured cyclically — the cause', () => {
    const depths = computeDepths(cyclic)

    expect(depths.get('x')).toBeUndefined()
    expect(depths.get('y')).toBeUndefined()
  })

  it('gives every node a depth once cycles are cut', () => {
    const depths = computeDepths(acyclicOf(cyclic))

    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x', 'y']) {
      expect(depths.get(id)).toBeTypeOf('number')
    }
  })

  it('keeps every windowed node INSIDE the window — no unpinned stragglers', () => {
    const edges = acyclicOf(cyclic)
    const depths = computeDepths(edges)
    const kept = limitDepth(edges, 5, 0)

    for (const id of kept) {
      const depth = depths.get(id)
      expect(depth).toBeTypeOf('number')
      expect(depth!).toBeGreaterThanOrEqual(0)
      expect(depth!).toBeLessThan(5)
    }
  })

  it('draws no more columns than the window asked for', () => {
    const edges = acyclicOf(cyclic)
    const kept = limitDepth(edges, 5, 0)
    const graph = withDepths(
      {
        nodes: [...kept].map((id) => ({
          id,
          name: id,
          kind: 'object' as const,
          role: 'intermediate' as const,
        })),
        links: [],
      },
      computeDepths(edges)
    )

    const columns = new Set(graph.nodes.map((n) => n.depth))
    expect(columns.size).toBeLessThanOrEqual(5)
    expect(columns.has(undefined)).toBe(false)
  })
})
