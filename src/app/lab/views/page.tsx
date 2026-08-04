'use client'

import { useState } from 'react'
import {
  ArrowDownUp,
  BarChart3,
  Filter,
  Kanban,
  LayoutGrid,
  List,
  ImageOff,
  Plus,
  Settings2,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { DetailPanel, type DetailRow } from './components/detail-panel'
import { SeededAvatar } from '../components/seeded-avatar'
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'

type ViewMode = 'list' | 'cards' | 'board' | 'timeline'

const VIEWS = [
  { id: 'list' as const, label: 'List', icon: List },
  { id: 'cards' as const, label: 'Cards', icon: LayoutGrid },
  { id: 'board' as const, label: 'Board', icon: Kanban },
  { id: 'timeline' as const, label: 'Timeline', icon: BarChart3 },
]

/**
 * Columns as TOGGLES rather than a fixed set.
 *
 * The app already has a column-visibility control on `DataTable`; the difference here is that
 * grouping, ordering and visibility live in ONE popover, so "what am I looking at" is answered in
 * one place instead of three scattered controls.
 */
const PROPERTIES = [
  'Type',
  'Owner',
  'Address',
  'Area',
  'Updated',
  'Files',
  'Parents',
  'Version',
]

const GROUPS = [
  {
    name: 'Northgate House',
    rows: [
      {
        name: 'Ground',
        type: 'Floor',
        owner: 'Me',
        area: '42 m²',
        cover: true,
      },
      {
        name: 'Room 101',
        type: 'Room',
        owner: 'Me',
        area: '24 m²',
        cover: true,
      },
      {
        name: 'Room 102',
        type: 'Room',
        owner: 'Anna Roos',
        area: '18 m²',
        cover: false,
      },
    ],
  },
  {
    name: 'Riverside Depot',
    rows: [
      {
        name: 'Ground',
        type: 'Floor',
        owner: 'Me',
        area: '52 m²',
        cover: true,
      },
      {
        name: 'Room 101',
        type: 'Room',
        owner: 'Ben Aker',
        area: '52 m²',
        cover: false,
      },
    ],
  },
]

export default function ViewsLabPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [grouping, setGrouping] = useState('parent')
  const [ordering, setOrdering] = useState('name')
  const [showEmpty, setShowEmpty] = useState(false)
  const [visible, setVisible] = useState<string[]>([
    'Type',
    'Owner',
    'Area',
    'Updated',
  ])

  const [selected, setSelected] = useState<DetailRow | null>(null)

  const total = GROUPS.reduce((sum, group) => sum + group.rows.length, 0)

  const open = (row: (typeof GROUPS)[number]['rows'][number], parent: string) =>
    setSelected({ ...row, parent })

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* A sticky header WITHIN the content card — this is what the inset layout buys. The
          previous full-bleed main had no edge for it to sit against. */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
          <h1 className="text-sm font-medium">Objects</h1>
          <Badge variant="outline" className="font-normal tabular-nums">
            {total}
          </Badge>

          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5">
              <Filter className="size-3.5" />
              Filter
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Display options"
                >
                  <Settings2 className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="grid grid-cols-4 gap-1 border-b p-2">
                  {VIEWS.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setView(option.id)}
                        aria-pressed={view === option.id}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          view === option.id
                            ? 'bg-muted font-medium'
                            : 'text-muted-foreground hover:bg-muted/60'
                        )}
                      >
                        <Icon className="size-3.5" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-2 border-b p-3">
                  <div className="flex items-center gap-2">
                    <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm">Grouping</span>
                    <Select value={grouping} onValueChange={setGrouping}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm">Ordering</span>
                    <Select value={ordering} onValueChange={setOrdering}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="updated">Last updated</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm">Show empty groups</span>
                    <Switch
                      checked={showEmpty}
                      onCheckedChange={setShowEmpty}
                      aria-label="Show empty groups"
                    />
                  </div>

                  <div>
                    <p className="pb-1.5 text-xs text-muted-foreground">
                      Display properties
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PROPERTIES.map((property) => {
                        const on = visible.includes(property)
                        return (
                          <button
                            key={property}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setVisible((prev) =>
                                on
                                  ? prev.filter((p) => p !== property)
                                  : [...prev, property]
                              )
                            }
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              on
                                ? 'border-primary/30 bg-primary/5 font-medium'
                                : 'text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {property}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button type="button" size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              New object
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {view === 'list' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {visible.map((property) => (
                    <TableHead key={property}>{property}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {GROUPS.map((group) => (
                  <>
                    <TableRow key={group.name} className="bg-muted/40">
                      <TableCell
                        colSpan={visible.length + 1}
                        className="py-1.5 text-xs font-medium"
                      >
                        {group.name}
                        <span className="ml-2 text-muted-foreground">
                          {group.rows.length}
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                      <TableRow
                        key={`${group.name}-${row.name}`}
                        onClick={() => open(row, group.name)}
                        className={cn(
                          'cursor-pointer',
                          selected?.name === row.name &&
                            selected?.parent === group.name &&
                            'bg-muted/60'
                        )}
                      >
                        <TableCell className="pl-6 text-sm">
                          <span className="flex items-center gap-2">
                            <SeededAvatar
                              seed={`${group.name}/${row.name}`}
                              square
                              className="size-5"
                            />
                            {row.name}
                          </span>
                        </TableCell>
                        {visible.map((property) => (
                          <TableCell
                            key={property}
                            className="text-sm text-muted-foreground"
                          >
                            {property === 'Type'
                              ? row.type
                              : property === 'Owner'
                                ? row.owner
                                : property === 'Area'
                                  ? row.area
                                  : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          )}

          {view === 'cards' && (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {GROUPS.flatMap((group) =>
                group.rows.map((row) => (
                  <article
                    key={`${group.name}-${row.name}`}
                    className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
                  >
                    {/* An object with no cover gets a labelled placeholder, not a blank box.
                      Freshly imported objects have NO cover by design — the import carries file
                      references and a cover must be an uploaded image — so an empty grid after
                      an import would read as broken rather than as expected. */}
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted/50">
                      {row.cover ? (
                        <span className="text-xs text-muted-foreground">
                          cover image
                        </span>
                      ) : (
                        <span className="flex flex-col items-center gap-1 text-muted-foreground/50">
                          <ImageOff className="size-5" />
                          <span className="text-[10px]">No cover</span>
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {group.name}
                      </p>
                      {/* Display properties drive the card too, so the popover controls one
                        vocabulary across every view instead of a per-view settings screen. */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {visible.includes('Type') && (
                          <Badge variant="outline" className="font-normal">
                            {row.type}
                          </Badge>
                        )}
                        {visible.includes('Area') && (
                          <Badge variant="outline" className="font-normal">
                            {row.area}
                          </Badge>
                        )}
                        {visible.includes('Owner') && (
                          <Badge variant="secondary" className="font-normal">
                            {row.owner}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {view === 'board' && (
            <div className="flex gap-3 p-4">
              {GROUPS.map((group) => (
                <div key={group.name} className="w-64 shrink-0 space-y-2">
                  <p className="text-sm font-medium">
                    {group.name}
                    <span className="ml-2 text-muted-foreground">
                      {group.rows.length}
                    </span>
                  </p>
                  {group.rows.map((row) => (
                    <div
                      key={row.name}
                      className="rounded-lg border bg-card p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.type} · {row.area} · {row.owner}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {view === 'timeline' && (
            <div className="p-4">
              <div className="mb-2 flex text-xs text-muted-foreground">
                {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((month) => (
                  <span key={month} className="flex-1">
                    {month}
                  </span>
                ))}
              </div>
              {GROUPS.flatMap((group) =>
                group.rows.map((row, index) => (
                  <div
                    key={`${group.name}-${row.name}`}
                    className="flex items-center gap-2 border-t py-2"
                  >
                    <span className="w-32 shrink-0 truncate text-sm">
                      {row.name}
                    </span>
                    <div className="relative h-5 flex-1 rounded bg-muted/50">
                      <div
                        className="absolute h-full rounded bg-primary/30"
                        style={{
                          left: `${index * 12}%`,
                          width: `${30 + index * 8}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DetailPanel row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
