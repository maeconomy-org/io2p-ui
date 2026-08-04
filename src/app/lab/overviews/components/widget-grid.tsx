'use client'

import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { Widget } from '../fixtures'
import { WidgetCard } from './widget-card'

const SPANS = [3, 4, 6, 12] as const
type Span = (typeof SPANS)[number]

const COLUMNS = 12

/**
 * Reorder and resize, without a drag-and-drop dependency.
 *
 * Native HTML5 drag events handle the pointer case in a few dozen lines. What they do NOT handle
 * is the keyboard — `draggable` is invisible to it — which is why every grip here is a real
 * button with its own arrow-key bindings rather than a decorative handle. A dashboard someone
 * cannot rearrange without a mouse is a dashboard half the point of which is missing.
 */
export function WidgetGrid({
  widgets,
  editing,
  onChange,
  onEdit,
  onRemove,
  onAdd,
}: {
  widgets: Widget[]
  /** Drag, resize and dashed edges exist only here. Reading a dashboard is the common case. */
  editing: boolean
  onChange: (next: Widget[]) => void
  onEdit: (widget: Widget) => void
  onRemove: (widget: Widget) => void
  onAdd: () => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [resizing, setResizing] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const move = (from: number, to: number) => {
    if (to < 0 || to >= widgets.length || from === to) return
    const next = [...widgets]
    const [lifted] = next.splice(from, 1)
    if (!lifted) return
    next.splice(to, 0, lifted)
    onChange(next)
    setAnnouncement(
      `${lifted.title} moved to position ${to + 1} of ${widgets.length}`
    )
  }

  const setSpan = (id: string, span: Span) => {
    const target = widgets.find((w) => w.id === id)
    if (!target || target.span === span) return
    onChange(widgets.map((w) => (w.id === id ? { ...w, span } : w)))
    setAnnouncement(`${target.title} resized to ${span} of ${COLUMNS} columns`)
  }

  const stepSpan = (widget: Widget, direction: 1 | -1) => {
    const current = SPANS.indexOf(widget.span as Span)
    const next = SPANS[current + direction]
    if (next) setSpan(widget.id, next)
  }

  /**
   * Resize snaps to the same four widths the builder offers.
   *
   * Free-form pixel widths would let a dashboard drift into columns that never line up between
   * rows — the thing a 12-column grid exists to prevent. Snapping keeps drag and the builder
   * producing the same set of values.
   */
  const startResize = (event: React.PointerEvent, widget: Widget) => {
    const grid = gridRef.current
    if (!grid) return
    event.preventDefault()
    setResizing(widget.id)

    const gridWidth = grid.getBoundingClientRect().width
    const columnWidth = gridWidth / COLUMNS
    const startX = event.clientX
    const startSpan = widget.span

    const onMove = (moveEvent: PointerEvent) => {
      const deltaColumns = Math.round(
        (moveEvent.clientX - startX) / columnWidth
      )
      const raw = startSpan + deltaColumns
      const snapped = SPANS.reduce((best, candidate) =>
        Math.abs(candidate - raw) < Math.abs(best - raw) ? candidate : best
      )
      setSpan(widget.id, snapped)
    }

    const onUp = () => {
      setResizing(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <>
      <div ref={gridRef} className="grid gap-3 md:grid-cols-12">
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            draggable={editing && dragIndex !== null ? true : undefined}
            onDragStart={(event) => {
              setDragIndex(index)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              if (!editing) return
              event.preventDefault()
              if (dragIndex !== null && index !== overIndex) setOverIndex(index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragIndex !== null) move(dragIndex, index)
              setDragIndex(null)
              setOverIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            className={cn(
              'group/widget relative transition-opacity',
              widget.span === 3 && 'md:col-span-3',
              widget.span === 4 && 'md:col-span-4',
              widget.span === 6 && 'md:col-span-6',
              widget.span === 12 && 'md:col-span-12',
              dragIndex === index && 'opacity-40',
              overIndex === index &&
                dragIndex !== index &&
                'rounded-lg ring-2 ring-primary ring-offset-2'
            )}
          >
            <WidgetCard
              widget={widget}
              editing={editing}
              index={index}
              total={widgets.length}
              resizing={resizing === widget.id}
              onEdit={() => onEdit(widget)}
              onRemove={() => onRemove(widget)}
              onGripDown={() => setDragIndex(index)}
              onGripUp={() => setDragIndex(null)}
              onMoveEarlier={() => move(index, index - 1)}
              onMoveLater={() => move(index, index + 1)}
              onGrow={() => stepSpan(widget, 1)}
              onShrink={() => stepSpan(widget, -1)}
              onResizeStart={(event) => startResize(event, widget)}
            />
          </div>
        ))}
        {/* A dashed placeholder rather than a floating button: in edit mode the grid is what
            you are manipulating, so "add" belongs in it, at the position the widget will take. */}
        {editing && (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-[8rem] items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-3"
          >
            <Plus className="size-4" />
            Add widget
          </button>
        )}
      </div>

      {/* Reordering by keyboard is silent otherwise — the card moves, but a screen reader user
          has no way to know where it landed. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
