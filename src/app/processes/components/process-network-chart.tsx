'use client'

// The overview render: the WHOLE graph at once, force-directed.
//
// It answers a different question from the Sankey. The Sankey is a layered acyclic layout, so it has
// to window depth and cut recirculation to draw at all — it shows how MUCH flows through a chain.
// This shows what connects to what: which chains are actually separate, and the few links that join
// them. Cycles are kept, because a recycled output feeding back into production is exactly the shape
// worth seeing here.

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import ReactECharts from 'echarts-for-react'

import {
  findBridges,
  graphDegrees,
  type GraphLink,
  type NodeKind,
  type ProcessGraph,
} from '../utils/process-graph'

/**
 * Same node hues as the Sankey — a node must not change identity between views. `bridge` is the third
 * slot, validated against both surfaces alongside the other two rather than picked to look warm.
 */
const PALETTE = {
  light: { object: '#0d9488', process: '#2563eb', bridge: '#c2410c' },
  dark: { object: '#0d9488', process: '#3b82f6', bridge: '#ea580c' },
}

const MIN_SYMBOL = 14
const MAX_SYMBOL = 46

/**
 * Spacing between neighbours on the seed ring, matched to the force layout's edge length so the
 * nodes start at roughly the distance they will end up at. Travel distance IS the settle time.
 */
const SEED_SPACING = 95

export interface ProcessNetworkChartProps {
  graph: ProcessGraph
  onNodeClick?: (nodeId: string) => void
  onLinkClick?: (link: GraphLink) => void
  height?: number
}

export function ProcessNetworkChart({
  graph,
  onNodeClick,
  onLinkClick,
  height = 620,
}: ProcessNetworkChartProps) {
  const t = useTranslations()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = isDark ? PALETTE.dark : PALETTE.light

  const option = useMemo(() => {
    const ink = isDark ? '#e2e8f0' : '#334155'
    const mutedInk = isDark ? '#94a3b8' : '#64748b'
    const line = isDark ? '#475569' : '#cbd5e1'

    const degrees = graphDegrees(graph.links)
    const bridges = findBridges(graph.links)
    const maxDegree = Math.max(1, ...degrees.values())
    const nameOf = new Map(graph.nodes.map((n) => [n.id, n.name || n.id]))

    // Ring sized so neighbours start about one edge-length apart, whatever the node count.
    const seedRadius = Math.max(
      90,
      (graph.nodes.length * SEED_SPACING) / (2 * Math.PI)
    )

    const chartNodes = graph.nodes.map((node, index) => {
      const degree = degrees.get(node.id) ?? 0
      const isProcess = node.kind === 'process'
      // Seed positions on a ring by index. ECharts otherwise randomizes them, which cost twice: the
      // settle was long because nodes started far from equilibrium, and every re-render — a theme
      // flip, a filter change — reshuffled the whole graph so you lost your place.
      const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2
      return {
        id: node.id,
        name: node.id,
        x: Math.cos(angle) * seedRadius,
        y: Math.sin(angle) * seedRadius,
        // Size carries how busy a node is, so the hubs of each network read as hubs. Square-rooted
        // because area, not radius, is what the eye compares.
        symbolSize:
          MIN_SYMBOL +
          (MAX_SYMBOL - MIN_SYMBOL) * Math.sqrt(degree / maxDegree),
        // Shape carries KIND: a thing is a circle, an operation is a diamond. Distinct in greyscale
        // and at a glance, which colour alone is not on a dense canvas.
        symbol: isProcess ? 'diamond' : 'circle',
        itemStyle: {
          color: isProcess ? colors.process : colors.object,
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 1.5,
        },
        label: {
          show: degree > 1 || graph.nodes.length <= 40,
          position: 'bottom' as const,
          formatter: () => node.name || shortId(node.id),
          fontSize: 10,
          color: ink,
          ...(isProcess ? { fontStyle: 'italic' as const } : {}),
        },
        kind: node.kind,
        displayName: node.name,
        degree,
      }
    })

    const chartLinks = graph.links.map((link) => {
      const isBridge = bridges.has(link.flowId)
      return {
        source: link.source,
        target: link.target,
        lineStyle: {
          // A bridge is the ONLY link between two otherwise-separate networks — cut it and they fall
          // apart. That is the connection worth seeing, so it is the one thing drawn loudly.
          color: isBridge ? colors.bridge : line,
          width: isBridge ? 2.5 : 1,
          opacity: isBridge ? 0.95 : 0.5,
          curveness: 0.12,
        },
        emphasis: { lineStyle: { width: isBridge ? 3.5 : 2, opacity: 1 } },
        flow: link,
        isBridge,
      }
    })

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark
          ? 'rgba(15,23,42,0.96)'
          : 'rgba(255,255,255,0.97)',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        textStyle: { fontSize: 12, color: ink },
        confine: true,
        formatter: (params: NetworkParams) =>
          params.data.flow
            ? linkTooltip(params.data, nameOf, mutedInk, t)
            : nodeTooltip(params, mutedInk, t),
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: chartNodes,
          links: chartLinks,
          roam: true,
          draggable: true,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 7,
          force: {
            // Separate networks drift apart on their own with enough repulsion, which is what makes
            // "these are three unrelated chains" visible without colouring them.
            repulsion: 220,
            gravity: 0.12,
            edgeLength: [70, 130],
            // Kept ANIMATED on purpose: turning the layout animation off settles the graph before
            // the first paint, but then a drag has nothing to animate and the nodes stop responding.
            // The settle is short because the seeded ring above starts them near where they end up —
            // the jiggle was never the animation, it was the distance travelled from random.
            friction: 0.6,
          },
          emphasis: { focus: 'adjacency', scale: false },
          blur: { itemStyle: { opacity: 0.2 }, lineStyle: { opacity: 0.05 } },
          labelLayout: { hideOverlap: true },
        },
      ],
    }
  }, [graph, isDark, colors, t])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge
      opts={{ renderer: 'canvas' }}
      onEvents={{
        click: (params: NetworkParams) => {
          if (params.data.flow) onLinkClick?.(params.data.flow)
          else onNodeClick?.(params.name)
        },
      }}
    />
  )
}

interface NetworkParams {
  name: string
  data: {
    kind?: NodeKind
    displayName?: string
    degree?: number
    flow?: GraphLink
    isBridge?: boolean
  }
}

const shortId = (id: string) => `${id.slice(0, 8)}…`

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c
  )

function nodeTooltip(
  params: NetworkParams,
  mutedInk: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const { data, name } = params
  return `<div style="min-width:150px">
      <div style="font-weight:600;font-size:13px">${escapeHtml(
        data.displayName || shortId(name)
      )}</div>
      <div style="font-size:11px;color:${mutedInk};margin-top:2px">
        ${escapeHtml(t(`processes.flowView.kind.${data.kind ?? 'object'}`))}
        · ${escapeHtml(
          t('processes.networkView.flowCount', { count: data.degree ?? 0 })
        )}
      </div>
    </div>`
}

function linkTooltip(
  data: { flow?: GraphLink; isBridge?: boolean },
  nameOf: Map<string, string>,
  mutedInk: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const link = data.flow!
  const from = nameOf.get(link.source) ?? link.source
  const to = nameOf.get(link.target) ?? link.target
  const bridge = data.isBridge
    ? `<div style="font-size:11px;color:${mutedInk};margin-top:5px">${escapeHtml(
        t('processes.networkView.bridgeHint')
      )}</div>`
    : ''

  return `<div style="min-width:180px">
      <div style="font-weight:600;font-size:13px">${escapeHtml(from)} → ${escapeHtml(to)}</div>
      <div style="font-size:11px;color:${mutedInk};margin-top:1px">${escapeHtml(
        link.processName
      )}</div>
      ${
        link.display
          ? `<div style="font-weight:600;font-size:12px;margin-top:5px">${escapeHtml(
              link.display
            )}</div>`
          : ''
      }
      ${bridge}
    </div>`
}
