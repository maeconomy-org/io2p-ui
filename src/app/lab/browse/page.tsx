'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  Filter,
  Maximize2,
  Minimize2,
  Plus,
  Search,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Button, Input } from '@/components/ui'

import { SeededAvatar } from '../components/seeded-avatar'
import { DetailBody, type BrowseItem } from './components/detail-body'

const ITEMS: BrowseItem[] = [
  {
    id: 'nh',
    name: 'Northgate House',
    parent: 'Portfolio › US West',
    type: 'Building',
    owner: 'Me',
    area: '1,847 m²',
    children: 31,
    condition: 'Good',
  },
  {
    id: 'nh-g',
    name: 'Ground',
    parent: 'Northgate House',
    type: 'Floor',
    owner: 'Me',
    area: '42 m²',
    children: 2,
    condition: 'Good',
  },
  {
    id: 'nh-101',
    name: 'Room 101',
    parent: 'Northgate House › Ground',
    type: 'Room',
    owner: 'Me',
    area: '24 m²',
    children: 3,
    condition: 'Good',
  },
  {
    id: 'nh-102',
    name: 'Room 102',
    parent: 'Northgate House › Ground',
    type: 'Room',
    owner: 'Anna Roos',
    area: '18 m²',
    children: 0,
    condition: 'Fair',
  },
  {
    id: 'rd',
    name: 'Riverside Depot',
    parent: 'Portfolio › US West',
    type: 'Building',
    owner: 'Me',
    area: '892 m²',
    children: 14,
    condition: 'Poor',
  },
  {
    id: 'rd-101',
    name: 'Room 101',
    parent: 'Riverside Depot › Ground',
    type: 'Room',
    owner: 'Ben Aker',
    area: '52 m²',
    children: 1,
    condition: 'Poor',
  },
]

const CONDITION_TONE: Record<string, string> = {
  Good: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  Fair: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  Poor: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
}

/**
 * Two columns: a narrow index, and the selected object at a size worth reading.
 *
 * The slide-over panel elsewhere in the lab is 32rem — enough for facts, too narrow for a
 * property with several values and a file on each, which then wraps into a column of chips.
 * Here the detail gets the majority of the width by default and the list keeps just enough to
 * stay navigable, so moving between siblings costs one click and no context.
 *
 * The third state matters as much as the two: FOCUS hides the index entirely. Comparing two
 * rooms wants the list; filling in one room's properties wants the width. Neither is the answer
 * all the time, so the layout is a control rather than a decision made once.
 */
export default function BrowseLabPage() {
  const [activeId, setActiveId] = useState('nh-101')
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')

  const active = ITEMS.find((item) => item.id === activeId) ?? ITEMS[0]!
  const matches = ITEMS.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  )
  const index = ITEMS.findIndex((item) => item.id === activeId)

  return (
    <div className="flex h-full">
      {/* Width, not `hidden` — the list keeps its scroll position through a focus toggle. */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 motion-reduce:transition-none',
          focused ? 'w-0' : 'w-[22rem]'
        )}
      >
        <div className="w-[22rem] shrink-0 space-y-2 border-b p-3">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium">Objects</h1>
            <Badge variant="outline" className="font-normal tabular-nums">
              {ITEMS.length}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-7"
              aria-label="Filter"
            >
              <Filter className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="size-7"
              aria-label="New object"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this list…"
              aria-label="Filter the list"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="w-[22rem] flex-1 overflow-y-auto">
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              aria-current={item.id === activeId ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                item.id === activeId ? 'bg-muted' : 'hover:bg-muted/50'
              )}
            >
              <SeededAvatar
                seed={`${item.parent}/${item.name}`}
                square
                className="mt-0.5 size-8"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.parent}
                </span>
                {/* Enough to choose between two rooms without opening either. */}
                <span className="flex flex-wrap items-center gap-1 pt-1">
                  <Badge variant="outline" className="font-normal">
                    {item.type}
                  </Badge>
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {item.area}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-normal',
                      CONDITION_TONE[item.condition]
                    )}
                  >
                    {item.condition}
                  </Badge>
                </span>
              </span>
            </button>
          ))}

          {matches.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {focused && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setFocused(false)}
            >
              <ChevronLeft className="size-3.5" />
              Back to the list
            </Button>
          )}

          <nav className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate text-muted-foreground">
              {active.parent}
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium">{active.name}</span>
          </nav>

          {/* Sibling paging, which only exists because the list is a peer of the detail —
              a modal over a table cannot offer it without closing and reopening. */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span className="pr-1 text-xs tabular-nums text-muted-foreground">
              {index + 1} of {ITEMS.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Previous object"
              disabled={index === 0}
              onClick={() => setActiveId(ITEMS[index - 1]!.id)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rotate-180"
              aria-label="Next object"
              disabled={index === ITEMS.length - 1}
              onClick={() => setActiveId(ITEMS[index + 1]!.id)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={focused ? 'Show the list' : 'Focus this object'}
              aria-pressed={focused}
              onClick={() => setFocused((f) => !f)}
            >
              {focused ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DetailBody item={active} wide={focused} />
        </div>
      </div>
    </div>
  )
}
