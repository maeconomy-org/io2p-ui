'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import {
  AlertTriangle,
  ExternalLink,
  Focus,
  HelpCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { ContentSkeleton } from '@/components/skeletons'
import { cn } from '@/lib/utils'

import { useProcessGraph } from '../hooks/use-process-graph'
import {
  connectedComponents,
  findBridges,
  type GraphLink,
} from '../utils/process-graph'

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

const ProcessNetworkChart = dynamic(
  () => import('./process-network-chart').then((m) => m.ProcessNetworkChart),
  { loading: () => <ContentSkeleton />, ssr: false }
)

/**
 * The two graph views share everything except the chart and the depth window: same data, same focus
 * behaviour, same object filter, same way into an entity. They differ in the QUESTION they answer.
 *
 * - `sankey` — depth. A layered acyclic layout, so it windows levels and cuts recirculation, and in
 *   return it can show how much flows through a chain and where mass is lost.
 * - `network` — breadth. The whole graph force-directed, cycles kept, so it shows which chains are
 *   actually separate and the few links that join them.
 */
export type ProcessGraphVariant = 'sankey' | 'network'

export function ProcessFlowView({
  variant,
  onOpenProcess,
  relatedObjectId,
}: {
  variant: ProcessGraphVariant
  onOpenProcess: (processId: string) => void
  /** Narrow to one object's chains — set by `?ref=` when arriving from that object's Relations tab. */
  relatedObjectId?: string | null
}) {
  const t = useTranslations()
  const router = useRouter()

  const [depthLimited, setDepthLimited] = useState(true)
  const [windowStart, setWindowStart] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [unitOverride, setUnitOverride] = useState<string | null>(null)
  const [selectedObjects, setSelectedObjects] = useState<string[]>([])

  const layered = variant === 'sankey'

  // The URL's object composes with the toolbar's picks rather than replacing them — both narrow to
  // the same set, so they are one filter with two sources. Derived, never copied into state: clearing
  // `?ref=` clears the chart, which a `useState(initial)` seed would not.
  const highlighted = useMemo(
    () =>
      relatedObjectId
        ? [...new Set([relatedObjectId, ...selectedObjects])]
        : selectedObjects,
    [relatedObjectId, selectedObjects]
  )

  // Focus and the object filter each ask a whole-graph question ("what touches this?"), so neither
  // is answered inside a depth slice. Keeping the window would silently return nothing whenever the
  // chosen object happened to sit outside the current levels — an empty chart with no explanation.
  // The overview never windows at all: seeing the whole graph IS its job.
  const windowed =
    layered && depthLimited && !focusId && highlighted.length === 0

  const {
    graph,
    cutLinks,
    totalLevels,
    totalNodes,
    units,
    truncated,
    isLoading,
    error,
  } = useProcessGraph({
    window: windowed ? { from: windowStart, size: DEPTH_WINDOW_SIZE } : null,
    focus: focusId,
    focusHops: FOCUS_HOPS,
    highlightObjects: highlighted,
    acyclic: layered,
  })

  // `windowStart` is the user's INTENT; `useProcessGraph` clamps it against the real depth, and this
  // mirrors that clamp for the pager's own labels and arrows. Derived rather than an effect, which
  // spent a commit and a setState to land on a number both sides can simply compute.
  const start = Math.min(
    windowStart,
    Math.max(0, totalLevels - DEPTH_WINDOW_SIZE)
  )

  // The user's pick wins, but only once they have made one — otherwise follow the data, which may
  // not have loaded when this first renders.
  const activeUnit = unitOverride ?? units[0]?.unit ?? null

  const focusNode = useMemo(
    () => graph.nodes.find((n) => n.id === focusId) ?? null,
    [graph.nodes, focusId]
  )

  // The bar follows the user's INTENT, not whether the focused node happens to be in the graph as
  // currently fetched. Focusing re-slices and re-reads, and `graph.nodes` briefly does not contain
  // the node mid-transition — driving visibility off `focusNode` made the bar exit and re-enter
  // each time that happened, which is the flicker. `focusId` only changes when the user acts.
  const focusOpen = focusId !== null
  const focusLabel = focusNode?.name || focusId?.slice(0, 8) || ''

  const objectNodes = useMemo(
    () => graph.nodes.filter((n) => n.kind === 'object'),
    [graph.nodes]
  )

  // "Three separate networks joined by two links" says more about a graph than a node count does,
  // and it is the sentence the overview exists to make true.
  const shape = useMemo(() => {
    if (layered) return null
    const networks = new Set(connectedComponents(graph.links).values()).size
    return { networks, bridges: findBridges(graph.links).size }
  }, [layered, graph.links])

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

  return (
    <div className="space-y-3">
      <ProcessFlowToolbar
        depthLimited={depthLimited}
        onDepthLimitedChange={(limited) => {
          setDepthLimited(limited)
          setWindowStart(0)
        }}
        windowFrom={start + 1}
        windowTo={Math.min(start + DEPTH_WINDOW_SIZE, totalLevels)}
        totalLevels={totalLevels}
        windowSize={DEPTH_WINDOW_SIZE}
        canPrev={pagerActive && start > 0}
        canNext={pagerActive && start + DEPTH_WINDOW_SIZE < totalLevels}
        onPrev={() => setWindowStart(Math.max(0, start - DEPTH_WINDOW_STEP))}
        onNext={() => setWindowStart(start + DEPTH_WINDOW_STEP)}
        hiddenNodeCount={Math.max(0, totalNodes - graph.nodes.length)}
        depthDisabled={!!focusId || highlighted.length > 0}
        layered={layered}
        objects={objectNodes}
        selectedObjects={selectedObjects}
        onSelectedObjectsChange={setSelectedObjects}
      />

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <ContentSkeleton />
          ) : error ? (
            <EmptyState
              icon={<AlertTriangle className="h-10 w-10 text-destructive/60" />}
              title={t('processes.flowView.error')}
            />
          ) : graph.links.length === 0 ? (
            <EmptyState
              icon={<Workflow className="h-10 w-10 text-muted-foreground/50" />}
              title={t('processes.flowView.empty.title')}
              description={t('processes.flowView.empty.description')}
            />
          ) : (
            <>
              {layered ? (
                <ProcessFlowChart
                  graph={graph}
                  activeUnit={activeUnit}
                  onNodeClick={handleNodeClick}
                  onLinkClick={handleLinkClick}
                />
              ) : (
                <ProcessNetworkChart
                  graph={graph}
                  onNodeClick={handleNodeClick}
                  onLinkClick={handleLinkClick}
                />
              )}
              <Legend
                variant={variant}
                units={units}
                activeUnit={activeUnit}
                onActiveUnitChange={setUnitOverride}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Floats rather than sitting in the flow: focusing a node must not shove the chart down,
          which would move the very node the user just clicked. */}
      <FloatingActionBar
        open={focusOpen}
        label={t('processes.nodeFocus.viewing')}
      >
        <span className="flex min-w-0 items-center gap-2 px-2 text-sm">
          <Focus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="max-w-[14rem] truncate font-medium">
            {focusLabel}
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
          // Only resolvable once the node is in the fetched graph — that is what tells us whether it
          // is a process or an object, and so where "details" even goes.
          disabled={!focusNode}
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
        {/* Cut flows are real data. Saying so is the difference between a drawing decision and a
            silent omission — and it names the overview as the place to see them. */}
        {cutLinks.length > 0 && (
          <p>
            {t('processes.flowView.cyclesRemoved', { count: cutLinks.length })}{' '}
            {t('processes.networkView.seeOverview')}
          </p>
        )}
        {shape && (
          <p>
            {t('processes.networkView.networks', { count: shape.networks })}
            {shape.bridges > 0 &&
              ` · ${t('processes.networkView.bridges', {
                count: shape.bridges,
              })}`}
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
 * The unitless bucket's own unit is `''`, and Radix REFUSES an empty `SelectItem` value — it
 * reserves that for clearing the selection. It throws rather than warns, which unmounts the whole
 * flow view into the error boundary, so the crash lands on the chart and not on the one control
 * that caused it. Only reachable once the graph is mixed, which is why the picker being rendered at
 * all is what triggers it.
 */
const UNITLESS_VALUE = '__unitless__'

/**
 * Two categories, so a legend is mandatory: node kind must never rest on hue alone. Each swatch is
 * the same secondary cue its chart draws — a dashed wash in the Sankey, a diamond in the overview.
 */
function Legend({
  variant,
  units,
  activeUnit,
  onActiveUnitChange,
}: {
  variant: ProcessGraphVariant
  units: Array<{ unit: string; count: number }>
  activeUnit: string | null
  onActiveUnitChange: (unit: string) => void
}) {
  const t = useTranslations()
  const network = variant === 'network'

  return (
    <div
      data-testid="flow-legend"
      className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'h-3 w-3 bg-[#0d9488]',
            network ? 'rounded-full' : 'rounded-sm'
          )}
          aria-hidden="true"
        />
        {t('processes.flowView.kind.object')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'h-3 w-3 bg-[#2563eb] dark:bg-[#3b82f6]',
            network
              ? 'rotate-45'
              : 'rounded border-2 border-dashed border-[#2563eb] bg-[#2563eb]/20 dark:border-[#3b82f6] dark:bg-[#3b82f6]/25'
          )}
          aria-hidden="true"
        />
        <span className="italic">{t('processes.flowView.kind.process')}</span>
      </span>
      {network && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-5 rounded-full bg-[#c2410c] dark:bg-[#ea580c]"
            aria-hidden="true"
          />
          {t('processes.networkView.bridgeLegend')}
        </span>
      )}
      <span>
        {network
          ? t('processes.networkView.legendHint')
          : t('processes.flowView.legendHint')}
      </span>

      {/* Only worth a control when the data is actually mixed; one dimension needs no choice. And
          only in the layered view, where link WIDTH carries the magnitude. */}
      {!network && units.length > 1 && (
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span>{t('processes.flowView.unit.widths')}</span>
          <Select
            value={activeUnit === null ? '' : activeUnit || UNITLESS_VALUE}
            onValueChange={(value) =>
              onActiveUnitChange(value === UNITLESS_VALUE ? '' : value)
            }
          >
            <SelectTrigger
              className="h-7 w-[7.5rem] text-xs"
              aria-label={t('processes.flowView.unit.label')}
              data-testid="flow-unit-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map(({ unit, count }) => (
                <SelectItem
                  key={unit || UNITLESS_VALUE}
                  value={unit || UNITLESS_VALUE}
                >
                  {unit || t('processes.flowView.unit.unitless')} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('processes.flowView.unit.label')}
                  data-testid="flow-unit-help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {t('processes.flowView.unit.help')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      )}
    </div>
  )
}
