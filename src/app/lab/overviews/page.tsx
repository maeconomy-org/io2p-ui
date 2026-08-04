'use client'

import { useState } from 'react'
import { Check, LayoutDashboard, Pencil, Plus, Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, EmptyState } from '@/components/ui'

import { WidgetGrid } from './components/widget-grid'
import { WidgetBuilder } from './components/widget-builder'
import type { Dashboard, Widget } from './fixtures'
import { DASHBOARDS } from './fixtures'

export default function OverviewsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(DASHBOARDS)
  const [activeId, setActiveId] = useState(DASHBOARDS[0]?.id ?? '')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<Widget | null>(null)
  const [layoutMode, setLayoutMode] = useState(false)

  const active = dashboards.find((d) => d.id === activeId) ?? dashboards[0]

  const updateWidgets = (next: Widget[]) =>
    setDashboards((prev) =>
      prev.map((d) => (d.id === active?.id ? { ...d, widgets: next } : d))
    )

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <LayoutDashboard className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Overviews</h1>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              New dashboard
            </Button>
            {/* One toggle, two clearly different screens. Handles that live on hover are a
                feature you have to already know about, and they make an ordinary read of the
                numbers feel like something you could break by moving the mouse. */}
            <Button
              type="button"
              size="sm"
              variant={layoutMode ? 'default' : 'outline'}
              className="gap-1.5"
              onClick={() => setLayoutMode((m) => !m)}
              aria-pressed={layoutMode}
            >
              {layoutMode ? (
                <>
                  <Check className="size-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="size-3.5" />
                  Edit layout
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Dashboards as tabs rather than a separate index page: someone checking numbers
            switches between two or three of these constantly, and a round trip through a list
            each time is the difference between a habit and a chore. */}
        <div className="flex gap-1 px-3 pb-2">
          {dashboards.map((dashboard) => (
            <button
              key={dashboard.id}
              type="button"
              onClick={() => setActiveId(dashboard.id)}
              aria-current={dashboard.id === active?.id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dashboard.id === active?.id
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:bg-muted/60'
              )}
            >
              {dashboard.id === dashboards[0]?.id && (
                <Star className="size-3 fill-current text-amber-500" />
              )}
              {dashboard.name}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {active && active.widgets.length > 0 ? (
          <>
            <p className="pb-3 text-sm text-muted-foreground">
              {layoutMode
                ? 'Drag a card by its handle to reorder, or its right edge to resize. Arrow keys work too.'
                : active.description}
            </p>
            <WidgetGrid
              widgets={active.widgets}
              editing={layoutMode}
              onAdd={() => {
                setEditing(null)
                setBuilderOpen(true)
              }}
              onChange={updateWidgets}
              onEdit={(widget) => {
                setEditing(widget)
                setBuilderOpen(true)
              }}
              onRemove={(widget) =>
                updateWidgets(active.widgets.filter((w) => w.id !== widget.id))
              }
            />
          </>
        ) : (
          <EmptyState
            icon={<LayoutDashboard className="size-12" />}
            title="Nothing on this dashboard yet"
            description="A widget is a question about your objects — how many, how much, broken down by what."
            action={
              <Button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setBuilderOpen(true)
                }}
              >
                Add the first widget
              </Button>
            }
          />
        )}
      </div>

      <WidgetBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={editing}
        onSave={(widget) => {
          const current = active?.widgets ?? []
          updateWidgets(
            current.some((w) => w.id === widget.id)
              ? current.map((w) => (w.id === widget.id ? widget : w))
              : [...current, widget]
          )
        }}
      />
    </div>
  )
}
