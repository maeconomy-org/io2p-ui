'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import {
  AlertTriangle,
  ExternalLink,
  Focus,
  Loader2,
  Workflow,
  X,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  FloatingActionBar,
  FloatingActionBarSeparator,
} from '@/components/ui'
import { ContentSkeleton } from '@/components/skeletons'

import { useProcessGraph } from '../hooks/use-process-graph'
import type { GraphLink } from '../utils/process-graph'

import { ProcessFlowToolbar } from './process-flow-toolbar'

/**
 * Topological levels in one slice.
 *
 * The graph is bipartite — objects and processes alternate — so a level is half a step, and a full
 * transformation (object -> process -> object) is three. Five shows TWO chained transformations,
 * which is what the old three-level window showed before the hub model doubled the level count.
 */
const DEPTH_WINDOW_SIZE = 5

/**
 * The pager advances by size - 1, so consecutive slices OVERLAP by one level. That shared level is
 * the handoff: it is the right edge of one slice and the left edge of the next, so a flow crossing
 * the boundary stays traceable instead of falling into the gap between pages.
 *
 * Stepping by 4 also keeps every slice starting on an even level — an object layer — rather than
 * opening mid-transformation on a process whose inputs are off-screen.
 */
const DEPTH_WINDOW_STEP = DEPTH_WINDOW_SIZE - 1

/** Hops each way from a focused node. Two crosses a whole transformation, since kinds alternate. */
const FOCUS_HOPS = 2

const ProcessFlowChart = dynamic(
  () => import('./process-flow-chart').then((m) => m.ProcessFlowChart),
  { loading: () => <ContentSkeleton />, ssr: false }
)

export function ProcessFlowView({
  onOpenProcess,
}: {
  onOpenProcess: (processId: string) => void
}) {
  const t = useTranslations()
  const router = useRouter()

  const [depthLimited, setDepthLimited] = useState(true)
  const [windowStart, setWindowStart] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [unitOverride, setUnitOverride] = useState<string | null>(null)
  const [selectedObjects, setSelectedObjects] = useState<string[]>([])

  // Focus and the object filter each ask a whole-graph question ("what touches this?"), so neither
  // is answered inside a depth slice. Keeping the window would silently return nothing whenever the
  // chosen object happened to sit outside the current levels — an empty chart with no explanation.
  const windowed = depthLimited && !focusId && selectedObjects.length === 0

  const {
    graph,
    cutLinks,
    totalLevels,
    totalNodes,
    units,
    truncated,
    isLoading,
    isResolvingNames,
    error,
  } = useProcessGraph({
    window: windowed ? { from: windowStart, size: DEPTH_WINDOW_SIZE } : null,
    focus: focusId,
    focusHops: FOCUS_HOPS,
    highlightObjects: selectedObjects,
  })

  // A shallower graph (a refetch, or a filter applied) could leave the start past the new end,
  // rendering an empty slice with both arrows disabled — a dead end. Clamp back to the last slice.
  useEffect(() => {
    setWindowStart((start) =>
      Math.min(start, Math.max(0, totalLevels - DEPTH_WINDOW_SIZE))
    )
  }, [totalLevels])

  // The user's pick wins, but only once they have made one — otherwise follow the data, which may
  // not have loaded when this first renders.
  const activeUnit = unitOverride ?? units[0]?.unit ?? null

  const focusNode = useMemo(
    () => graph.nodes.find((n) => n.id === focusId) ?? null,
    [graph.nodes, focusId]
  )

  const objectNodes = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'object'),
    [graph.nodes]
  )

  const handleNodeClick = useCallback((nodeId: string) => {
    setFocusId((current) => (current === nodeId ? null : nodeId))
  }, [])

  const handleLinkClick = useCallback(
    (link: GraphLink) => onOpenProcess(link.processId),
    [onOpenProcess]
  )

  const openFocused = useCallback(() => {
    if (!focusNode) return
    if (focusNode.kind === 'process') onOpenProcess(focusNode.id)
    else router.push(`/objects/${focusNode.id}`)
  }, [focusNode, onOpenProcess, router])

  const pagerActive = windowed && totalLevels > DEPTH_WINDOW_SIZE

  if (isLoading) return <ContentSkeleton />

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-destructive/60" />}
        title={t('processes.flowView.error')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <ProcessFlowToolbar
        depthLimited={depthLimited}
        onDepthLimitedChange={(limited) => {
          setDepthLimited(limited)
          setWindowStart(0)
        }}
        windowFrom={windowStart + 1}
        windowTo={Math.min(windowStart + DEPTH_WINDOW_SIZE, totalLevels)}
        totalLevels={totalLevels}
        windowSize={DEPTH_WINDOW_SIZE}
        canPrev={pagerActive && windowStart > 0}
        canNext={pagerActive && windowStart + DEPTH_WINDOW_SIZE < totalLevels}
        onPrev={() => setWindowStart((s) => Math.max(0, s - DEPTH_WINDOW_STEP))}
        onNext={() => setWindowStart((s) => s + DEPTH_WINDOW_STEP)}
        hiddenNodeCount={Math.max(0, totalNodes - graph.nodes.length)}
        depthDisabled={!!focusId || selectedObjects.length > 0}
        units={units}
        activeUnit={activeUnit}
        onActiveUnitChange={setUnitOverride}
        objects={objectNodes}
        selectedObjects={selectedObjects}
        onSelectedObjectsChange={setSelectedObjects}
      />

      <Card>
        <CardContent className="pt-4">
          {graph.links.length === 0 ? (
            <EmptyState
              icon={<Workflow className="h-10 w-10 text-muted-foreground/50" />}
              title={t('processes.flowView.empty.title')}
              description={t('processes.flowView.empty.description')}
            />
          ) : (
            <>
              <ProcessFlowChart
                graph={graph}
                activeUnit={activeUnit}
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
              />
              <Legend />
            </>
          )}
        </CardContent>
      </Card>

      {/* Floats rather than sitting in the flow: focusing a node must not shove the chart down,
          which would move the very node the user just clicked. */}
      <FloatingActionBar
        open={!!focusNode}
        label={t('processes.nodeFocus.viewing')}
      >
        <span className="flex min-w-0 items-center gap-2 px-2 text-sm">
          <Focus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="max-w-[14rem] truncate font-medium">
            {focusNode?.name || focusNode?.id.slice(0, 8)}
          </span>
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground md:inline">
            {t('processes.nodeFocus.description')}
          </span>
        </span>
        <FloatingActionBarSeparator />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="whitespace-nowrap rounded-full"
          onClick={openFocused}
        >
          <ExternalLink className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">
            {t('processes.flowView.openDetails')}
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="whitespace-nowrap rounded-full"
          aria-label={t('processes.nodeFocus.clear')}
          onClick={() => setFocusId(null)}
        >
          <X className="h-3.5 w-3.5 sm:hidden" />
          <span className="hidden sm:inline">
            {t('processes.nodeFocus.clear')}
          </span>
        </Button>
      </FloatingActionBar>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {isResolvingNames && (
          <p className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('processes.flowView.resolvingNames')}
          </p>
        )}
        {/* Cut flows are real data. Saying so is the difference between a drawing decision and a
            silent omission — and the overview view is where they will be visible. */}
        {cutLinks.length > 0 && (
          <p>
            {t('processes.flowView.cyclesRemoved', { count: cutLinks.length })}
          </p>
        )}
        {truncated && (
          <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t('processes.flowView.truncated')}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Two categories, so a legend is mandatory: node kind must never rest on hue alone. The border on
 * the process swatch is the same secondary cue the chart draws.
 */
function Legend() {
  const t = useTranslations()
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-[#0d9488]" aria-hidden="true" />
        {t('processes.flowView.kind.object')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {/* Mirrors the chart: dashed outline over a wash, not a solid block. */}
        <span
          className="h-3 w-3 rounded border-2 border-dashed border-[#2563eb] bg-[#2563eb]/20 dark:border-[#3b82f6] dark:bg-[#3b82f6]/25"
          aria-hidden="true"
        />
        <span className="italic">{t('processes.flowView.kind.process')}</span>
      </span>
      <span>{t('processes.flowView.legendHint')}</span>
    </div>
  )
}
