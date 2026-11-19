'use client'

// The Sankey render. Presentation only — it takes a finished graph and reports clicks; all the
// topology, windowing and cycle-breaking happened upstream in `process-graph.ts`.

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import ReactECharts from 'echarts-for-react'

import type { GraphLink, NodeKind, ProcessGraph } from '../utils/process-graph'

/**
 * One hue per node kind, chosen per mode against that mode's surface rather than flipped, and
 * validated for colour-vision separation and contrast.
 *
 * Hue is only half of it: an object is a solid block of material, a process is a dashed outline over
 * a wash — an operation, not a thing. That reads at a glance and survives greyscale, colour-vision
 * deficiency and the two nodes sitting side by side.
 */
const PALETTE = {
  light: {
    object: '#0d9488',
    process: '#2563eb',
    processFill: 'rgba(37, 99, 235, 0.22)',
  },
  dark: {
    object: '#0d9488',
    process: '#3b82f6',
    processFill: 'rgba(59, 130, 246, 0.26)',
  },
}

/**
 * Floor on a link's width, as a fraction of the widest link.
 *
 * Without it a "1 pcs" flow beside a "300 kg" one renders sub-pixel: invisible, and impossible to
 * hover or click. Links above the floor keep their true proportion.
 */
const MIN_LINK_FRACTION = 0.04

export interface ProcessFlowChartProps {
  graph: ProcessGraph
  /** Canonical unit whose magnitudes drive the widths. Others draw at the floor. */
  activeUnit: string | null
  onNodeClick?: (nodeId: string) => void
  onLinkClick?: (link: GraphLink) => void
  height?: number
}

export function ProcessFlowChart({
  graph,
  activeUnit,
  onNodeClick,
  onLinkClick,
  height = 620,
}: ProcessFlowChartProps) {
  const t = useTranslations()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = isDark ? PALETTE.dark : PALETTE.light

  const option = useMemo(() => {
    const ink = isDark ? '#e2e8f0' : '#334155'
    const mutedInk = isDark ? '#94a3b8' : '#64748b'

    const nameOf = new Map(graph.nodes.map((n) => [n.id, n.name || n.id]))

    const chartNodes = graph.nodes.map((node) => {
      const isProcess = node.kind === 'process'
      return {
        name: node.id,
        // Pin the column only when the layering produced one; a node with no acyclic depth is left
        // for ECharts to place rather than forced to a wrong column.
        ...(Number.isInteger(node.depth) ? { depth: node.depth } : {}),
        itemStyle: isProcess
          ? {
              color: colors.processFill,
              borderColor: colors.process,
              borderWidth: 2,
              borderType: 'dashed' as const,
              borderRadius: 5,
            }
          : {
              color: colors.object,
              borderWidth: 0,
              borderRadius: 2,
            },
        label: {
          formatter: () => node.name || shortId(node.id),
          color: ink,
          // A process is the operation between materials, so its name reads better set apart from
          // the block of objects either side of it.
          ...(isProcess ? { fontStyle: 'italic' as const } : {}),
        },
        kind: node.kind,
        role: node.role,
        displayName: node.name,
      }
    })

    const inActiveUnit = (link: GraphLink) =>
      link.num !== undefined && (link.unit ?? '') === activeUnit

    const magnitudes = graph.links.filter(inActiveUnit).map((l) => l.num ?? 0)
    const maxMagnitude = Math.max(1, ...magnitudes)
    const floor = maxMagnitude * MIN_LINK_FRACTION

    const chartLinks = graph.links.map((link) => {
      const measured = inActiveUnit(link)
      return {
        source: link.source,
        target: link.target,
        // A flow with no quantity, or one measured in another dimension, still draws — at the floor
        // rather than at zero. Hiding it would make a real flow silently vanish.
        value: measured ? Math.max(link.num ?? 0, floor) : floor,
        lineStyle: {
          opacity: measured ? 0.45 : 0.16,
        },
        emphasis: { lineStyle: { opacity: 0.8 } },
        flow: link,
        measured,
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
        formatter: (params: EChartsTooltipParams) =>
          params.data.flow
            ? linkTooltip(params.data.flow, nameOf, mutedInk, t)
            : nodeTooltip(params, mutedInk, t),
      },
      series: [
        {
          type: 'sankey',
          data: chartNodes,
          links: chartLinks,
          // Wide enough for the dashed process outline to read as an outline.
          nodeWidth: 18,
          nodeGap: 12,
          nodeAlign: 'right',
          layoutIterations: 48,
          emphasis: { focus: 'adjacency' },
          blur: {
            itemStyle: { opacity: 0.25 },
            lineStyle: { opacity: 0.06 },
          },
          label: { fontSize: 11, color: ink },
          lineStyle: { color: 'gradient', curveness: 0.5 },
        },
      ],
      animationDuration: 600,
      animationEasing: 'cubicOut',
    }
  }, [graph, activeUnit, isDark, colors, t])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge
      opts={{ renderer: 'canvas' }}
      onEvents={{
        click: (params: EChartsTooltipParams) => {
          if (params.data.flow) onLinkClick?.(params.data.flow)
          else onNodeClick?.(params.name)
        },
      }}
    />
  )
}

interface NodeDatum {
  kind: NodeKind
  displayName: string
}

/** ECharts hands the datum back verbatim, so the extras put on it above come with it. */
interface EChartsTooltipParams {
  dataType?: 'node' | 'edge'
  name: string
  data: Partial<NodeDatum> & { flow?: GraphLink }
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
  params: EChartsTooltipParams,
  mutedInk: string,
  t: (key: string) => string
): string {
  const { data, name } = params
  const title = data.displayName || shortId(name)
  return `<div style="min-width:150px">
      <div style="font-weight:600;font-size:13px">${escapeHtml(title)}</div>
      <div style="font-size:11px;color:${mutedInk};margin-top:2px">
        ${escapeHtml(t(`processes.flowView.kind.${data.kind}`))}
      </div>
    </div>`
}

/**
 * Endpoints, the process, and the quantity AS TYPED — the canonical number drives the width, but the
 * user's own "0.1 t" is what they recognise.
 */
function linkTooltip(
  link: GraphLink,
  nameOf: Map<string, string>,
  mutedInk: string,
  t: (key: string) => string
): string {
  const from = nameOf.get(link.source) ?? link.source
  const to = nameOf.get(link.target) ?? link.target
  const quantity = link.display
    ? `<div style="display:flex;justify-content:space-between;gap:20px;margin-top:6px">
         <span style="color:${mutedInk};font-size:11px">${escapeHtml(
           link.label || t('processes.flows.quantity')
         )}</span>
         <span style="font-weight:600;font-size:12px">${escapeHtml(link.display)}</span>
       </div>`
    : `<div style="color:${mutedInk};font-size:11px;margin-top:6px">${escapeHtml(
        t('processes.flowView.noQuantity')
      )}</div>`

  return `<div style="min-width:180px">
      <div style="font-weight:600;font-size:13px">${escapeHtml(from)} → ${escapeHtml(to)}</div>
      <div style="font-size:11px;color:${mutedInk};margin-top:1px">${escapeHtml(
        link.processName
      )}</div>
      ${quantity}
    </div>`
}
