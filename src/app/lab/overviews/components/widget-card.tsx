'use client'

import { GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'

import type { Slice, Widget } from '../fixtures'
import { TREND, measureLabel, resultFor } from '../fixtures'
import { Kpi } from './kpi'

/**
 * Charts are CSS and inline SVG, not ECharts.
 *
 * The app already ships ECharts, and the real widgets should use it. Here the question is layout —
 * how a dashboard reads at four widgets and at twelve — and a 400 KB chart bundle behind a dynamic
 * import answers none of it while making every reload slower.
 */
const PALETTE = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
]

function Bars({ slices }: { slices: Slice[] }) {
  const max = Math.max(...slices.map((s) => s.value), 1)
  return (
    <div className="space-y-2">
      {slices.map((slice, i) => (
        <div key={slice.label} className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="truncate">{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {slice.value.toLocaleString('en-US')}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', PALETTE[i % PALETTE.length])}
              style={{ width: `${(slice.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const STROKES = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']

/**
 * Arc offsets computed UP FRONT, not accumulated while mapping.
 *
 * A `let offset` mutated inside `.map()` runs during render, and React's immutability rule flags
 * it for a real reason: under a re-render that reuses the closure the running total starts from
 * wherever it was left, and the slices silently rotate.
 */
function arcs(slices: Slice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1
  let running = 0
  return slices.map((slice) => {
    const length = (slice.value / total) * CIRCUMFERENCE
    const offset = running
    running += length
    return { ...slice, length, offset, share: slice.value / total }
  })
}

function Donut({ slices }: { slices: Slice[] }) {
  const segments = arcs(slices)

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90">
        {segments.map((segment, i) => (
          <circle
            key={segment.label}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="14"
            stroke={STROKES[i % STROKES.length]}
            strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
            strokeDashoffset={-segment.offset}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {segments.map((segment, i) => (
          <li key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: STROKES[i % STROKES.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {Math.round(segment.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Trend({ slices }: { slices: Slice[] }) {
  const max = Math.max(...slices.map((s) => s.value), 1)
  const points = slices
    .map((slice, i) => {
      const x = (i / Math.max(slices.length - 1, 1)) * 100
      const y = 40 - (slice.value / max) * 34
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-24 w-full"
      >
        <polyline
          points={points}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        {slices.map((slice) => (
          <span key={slice.label}>{slice.label}</span>
        ))}
      </div>
    </div>
  )
}

/**
 * Interactive props are OPTIONAL so the same card renders read-only.
 *
 * The agent panel shows a widget it just built; a second component would be a second place for
 * the donut maths and the query caption to drift. Absent handlers mean absent affordances — the
 * grip and resize edge are not rendered rather than rendered inert.
 */
export function WidgetCard({
  widget,
  index = 0,
  total = 1,
  resizing = false,
  onEdit,
  onRemove,
  onGripDown,
  onGripUp,
  onMoveEarlier,
  onMoveLater,
  onGrow,
  onShrink,
  onResizeStart,
  editing = false,
}: {
  widget: Widget
  index?: number
  total?: number
  resizing?: boolean
  onEdit?: () => void
  onRemove?: () => void
  onGripDown?: () => void
  onGripUp?: () => void
  onMoveEarlier?: () => void
  onMoveLater?: () => void
  onGrow?: () => void
  onShrink?: () => void
  onResizeStart?: (event: React.PointerEvent) => void
  /** Handles and dashed edges only exist in edit mode — see `widget-grid`. */
  editing?: boolean
}) {
  const interactive = Boolean(onResizeStart) && Boolean(editing)
  const slices = widget.kind === 'trend' ? TREND : resultFor(widget.query)

  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-lg bg-card p-4 transition-all',
        // A dashed edge is the whole signal that a card is now MOVABLE. Solid borders in edit
        // mode would leave the two states looking identical, and a grip that only appears on
        // hover is a feature you have to already know about.
        editing ? 'border-2 border-dashed' : 'border',
        resizing && 'border-primary ring-2 ring-primary'
      )}
    >
      <div className="flex items-start justify-between gap-2 pb-3">
        {/* The grip is a real BUTTON, not a decorative handle. `draggable` is invisible to the
            keyboard, so arrow keys do the same two jobs the pointer does: move and resize. */}
        {interactive && (
          <button
            type="button"
            aria-label={`Move ${widget.title}. Position ${index + 1} of ${total}. Arrow keys to move, shift and arrow keys to resize.`}
            onPointerDown={onGripDown}
            onPointerUp={onGripUp}
            onKeyDown={(event) => {
              const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              const forward =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
              if (!back && !forward) return
              event.preventDefault()
              if (event.shiftKey) {
                if (back) onShrink?.()
                else onGrow?.()
                return
              }
              if (back) onMoveEarlier?.()
              else onMoveLater?.()
            }}
            className="-ml-1 mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground/40 transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{widget.title}</p>
          {/* The query in words, on the card. A dashboard nobody can audit is a dashboard
              nobody trusts — "is this filtered to mine?" should not require opening a dialog. */}
          <p className="truncate text-xs text-muted-foreground">
            {measureLabel(widget.query.measure)}
            {widget.query.groupBy && ` by ${widget.query.groupBy}`}
            {widget.query.filter.scope !== 'all' &&
              ` · ${widget.query.filter.scope}`}
          </p>
        </div>
        {(onEdit || onRemove) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Options for ${widget.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="gap-2">
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex-1">
        {widget.kind === 'kpi' && <Kpi widget={widget} />}
        {widget.kind === 'bar' && <Bars slices={slices} />}
        {widget.kind === 'donut' && <Donut slices={slices} />}
        {widget.kind === 'trend' && <Trend slices={slices} />}
        {widget.kind === 'table' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{widget.query.groupBy}</TableHead>
                <TableHead className="text-right">
                  {measureLabel(widget.query.measure)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slices.map((slice) => (
                <TableRow key={slice.label}>
                  <TableCell className="text-sm">{slice.label}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {slice.value.toLocaleString('en-US')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Resize from the right edge only. A corner handle implies free height, but row height
          here is content-driven — offering it would promise something the grid cannot keep. */}
      {interactive && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onPointerDown={onResizeStart}
          className="absolute inset-y-3 -right-1.5 w-3 cursor-col-resize rounded-full transition-opacity"
        >
          <span className="mx-auto block h-full w-1 rounded-full bg-border" />
        </button>
      )}
    </div>
  )
}
