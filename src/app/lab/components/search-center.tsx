'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Clock,
  CornerDownLeft,
  GitBranch,
  Library,
  Plus,
  Search,
  Sigma,
  Upload,
  User,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Dialog, DialogContent, DialogTitle } from '@/components/ui'

import { SeededAvatar } from './seeded-avatar'

/**
 * A filter typed INTO the query, not set beside it.
 *
 * The app already parses `key:value` search syntax, and this makes that visible: typing `type:`
 * offers the values, and a completed pair becomes a chip. Two gains over a filter panel — the
 * whole query is one string you can copy, paste and share, and the keyboard never has to leave
 * the input to narrow a search.
 */
const FILTER_KEYS = [
  {
    key: 'type',
    hint: 'room, floor, building',
    values: ['room', 'floor', 'building'],
  },
  { key: 'owner', hint: 'me, or a name', values: ['me', 'anna', 'ben'] },
  {
    key: 'in',
    hint: 'under an object',
    values: ['Northgate House', 'Riverside Depot'],
  },
  { key: 'has', hint: 'a property key', values: ['area', 'mass', 'co2'] },
  {
    key: 'missing',
    hint: 'objects lacking it',
    values: ['area', 'use', 'cover'],
  },
  { key: 'updated', hint: 'today, this week', values: ['today', 'this week'] },
]

type ResultKind = 'object' | 'process' | 'formula' | 'person' | 'action'

interface Result {
  id: string
  kind: ResultKind
  title: string
  detail: string
  badge?: string
}

const RESULTS: Result[] = [
  {
    id: 'o1',
    kind: 'object',
    title: 'Room 101',
    detail: 'Northgate House › Ground',
    badge: '24 m²',
  },
  {
    id: 'o2',
    kind: 'object',
    title: 'Room 102',
    detail: 'Northgate House › Ground',
    badge: '18 m²',
  },
  {
    id: 'o3',
    kind: 'object',
    title: 'Northgate House',
    detail: 'Portfolio › US West',
    badge: '31 children',
  },
  {
    id: 'p1',
    kind: 'process',
    title: 'Strip-out of Room 101',
    detail: '2 inputs, 3 outputs',
  },
  {
    id: 'f1',
    kind: 'formula',
    title: 'Embodied CO₂',
    detail: 'mass * co2_factor',
  },
  {
    id: 'u1',
    kind: 'person',
    title: 'Anna Roos',
    detail: 'anna@northgate.example',
  },
]

const GROUPS: { kind: ResultKind; label: string; icon: typeof Boxes }[] = [
  { kind: 'object', label: 'Objects', icon: Boxes },
  { kind: 'process', label: 'Processes', icon: GitBranch },
  { kind: 'formula', label: 'Library', icon: Library },
  { kind: 'person', label: 'People', icon: User },
]

const RECENT = [
  'type:room missing:area',
  'Northgate',
  'owner:me updated:this week',
]

/**
 * Actions in the same list as results.
 *
 * "Create an object called Storage 4" only makes sense once the search has failed to find one,
 * and that is exactly when it should appear. Keeping it in the result list means one keyboard
 * path — arrow, enter — rather than a separate button nobody tabs to.
 */
function actionsFor(query: string): Result[] {
  const bare = query.replace(/\w+:\S+/g, '').trim()
  if (!bare) return []
  return [
    {
      id: 'a-create',
      kind: 'action',
      title: `Create an object called “${bare}”`,
      detail: 'Opens the create sheet with the name filled in',
    },
    {
      id: 'a-import',
      kind: 'action',
      title: `Import a sheet of “${bare}”`,
      detail: 'Starts the import wizard',
    },
  ]
}

export function SearchCenter({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  // A completed `key:value` pair is a chip; the rest is free text. Parsed on every keystroke so
  // what is on screen can never disagree with what will be searched.
  const { chips, text, pendingKey } = useMemo(() => {
    const found: { key: string; value: string }[] = []
    let rest = query
    const pairs = query.matchAll(/(\w+):(\S+)/g)
    for (const match of pairs) {
      found.push({ key: match[1]!, value: match[2]! })
      rest = rest.replace(match[0], '')
    }
    const trailing = query.match(/(\w+):$/)
    return { chips: found, text: rest.trim(), pendingKey: trailing?.[1] }
  }, [query])

  const suggestion = pendingKey
    ? FILTER_KEYS.find((f) => f.key === pendingKey)
    : undefined

  const matches = RESULTS.filter((result) => {
    if (!text) return true
    return (
      result.title.toLowerCase().includes(text.toLowerCase()) ||
      result.detail.toLowerCase().includes(text.toLowerCase())
    )
  })

  const actions = actionsFor(query)
  const flat = [...matches, ...actions]
  const active = flat[Math.min(cursor, flat.length - 1)]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden p-0"
        noContainer
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />

          {/* Chips sit INSIDE the field, before the caret — so the query reads as one thing
              rather than a box plus a row of pills that can drift out of sync with it. */}
          {chips.map((chip) => (
            <span
              key={`${chip.key}:${chip.value}`}
              className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
            >
              <span className="text-muted-foreground">{chip.key}:</span>
              {chip.value}
              <button
                type="button"
                aria-label={`Remove ${chip.key} filter`}
                onClick={() =>
                  setQuery((q) =>
                    q.replace(`${chip.key}:${chip.value}`, '').trim()
                  )
                }
                className="rounded-sm hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, flat.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              }
            }}
            autoFocus
            placeholder="Search, or type a filter like type:room"
            aria-label="Search"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="flex max-h-[26rem]">
          <div className="min-w-0 flex-1 overflow-y-auto p-2">
            {/* Typing `type:` shows what can follow it. A syntax nobody can discover is a
                syntax nobody uses, and this is where the app's parser becomes teachable. */}
            {suggestion ? (
              <div className="p-1">
                <p className="px-2 pb-1 text-xs text-muted-foreground">
                  Values for <code>{suggestion.key}</code>
                </p>
                {suggestion.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQuery((q) => `${q}${value} `)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {suggestion.key}:{value}
                    </span>
                  </button>
                ))}
              </div>
            ) : query === '' ? (
              <>
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Recent
                </p>
                {RECENT.map((recent) => (
                  <button
                    key={recent}
                    type="button"
                    onClick={() => setQuery(recent)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{recent}</span>
                  </button>
                ))}

                <p className="px-2 pb-1 pt-3 text-xs text-muted-foreground">
                  Filters
                </p>
                <div className="flex flex-wrap gap-1 px-2">
                  {FILTER_KEYS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setQuery(`${filter.key}:`)}
                      title={filter.hint}
                      className="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {filter.key}:
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {GROUPS.map((group) => {
                  const items = matches.filter((r) => r.kind === group.kind)
                  if (items.length === 0) return null
                  const Icon = group.icon
                  return (
                    <div key={group.kind} className="pb-2">
                      <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                        <Icon className="size-3" />
                        {group.label}
                        <span className="tabular-nums">{items.length}</span>
                      </p>
                      {items.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onMouseEnter={() => setCursor(flat.indexOf(result))}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                            active?.id === result.id && 'bg-muted'
                          )}
                        >
                          {result.kind === 'person' ? (
                            <SeededAvatar seed={result.id} className="size-5" />
                          ) : (
                            <SeededAvatar
                              seed={result.title}
                              square
                              className="size-5"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {result.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.detail}
                            </span>
                          </span>
                          {result.badge && (
                            <Badge
                              variant="outline"
                              className="shrink-0 font-normal"
                            >
                              {result.badge}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}

                {actions.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      Actions
                    </p>
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onMouseEnter={() => setCursor(flat.indexOf(action))}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                          active?.id === action.id && 'bg-muted'
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded border">
                          {action.id === 'a-import' ? (
                            <Upload className="size-3" />
                          ) : (
                            <Plus className="size-3" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {action.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {action.detail}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {matches.length === 0 && actions.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nothing matched.
                  </p>
                )}
              </>
            )}
          </div>

          {/* A preview beside the list, so choosing between two similarly named rooms does not
              need a round trip. This is the thing a flat command palette cannot do. */}
          {active && active.kind !== 'action' && (
            <div className="hidden w-64 shrink-0 border-l p-4 sm:block">
              <SeededAvatar
                seed={active.title}
                square={active.kind !== 'person'}
                className="size-12"
              />
              <p className="pt-2 text-sm font-medium">{active.title}</p>
              <p className="text-xs text-muted-foreground">{active.detail}</p>
              <dl className="space-y-1 pt-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>Anna Roos</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>2 Aug</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="tabular-nums">3</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" />
            open
          </span>
          <span className="flex items-center gap-1">
            <ArrowRight className="size-3" />
            preview
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Sigma className="size-3" />
            {matches.length} results
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
