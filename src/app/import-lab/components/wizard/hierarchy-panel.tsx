'use client'

import { Lightbulb, Rows3, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

import type { LabMapping } from '../../wizard-fixtures'
import {
  DATA_ROWS,
  LAB_COLUMNS,
  SUGGESTED_LEVELS,
  buildTree,
} from '../../wizard-fixtures'

const NONE = 'none'

const MODES = [
  {
    id: 'none' as const,
    title: 'One row, one object',
    body: 'Nothing is nested. 1,200 rows become 1,200 objects.',
  },
  {
    id: 'levels' as const,
    title: 'Columns repeat down the sheet',
    body: 'Building repeats on every one of its rooms. Each repeated value becomes a parent.',
  },
  {
    id: 'keys' as const,
    title: 'The sheet has id and parent id',
    body: 'Every row already names itself and its parent. One row, one object, linked.',
  },
]

function ColumnSelect({
  value,
  onChange,
  placeholder,
  taken = [],
}: {
  value: number | null
  onChange: (next: number | null) => void
  placeholder: string
  taken?: number[]
}) {
  return (
    <Select
      value={value === null ? NONE : String(value)}
      onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {LAB_COLUMNS.map((column) => (
          <SelectItem
            key={column.index}
            value={String(column.index)}
            disabled={taken.includes(column.index) && column.index !== value}
          >
            {column.header}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * How rows relate to each other — asked as a question, answered by the user.
 *
 * The old copy read "Hierarchy / Order sets the nesting", which names a mechanism nobody has met
 * yet and describes a consequence rather than an action. The question the operator can actually
 * answer is about their SHEET: does a column repeat, or does the sheet carry ids? Both answers
 * reduce to the same tempId envelope, so the vocabulary can be theirs rather than the protocol's.
 */
export function HierarchyPanel({
  mapping,
  onChange,
}: {
  mapping: LabMapping
  onChange: (next: LabMapping) => void
}) {
  const set = (patch: Partial<LabMapping>) => onChange({ ...mapping, ...patch })
  const { hierarchyMode, levels } = mapping

  // Derived, never asserted. Drop a level and this number moves with it.
  const tree = buildTree(levels)
  const perLevel = levels.map(
    (_, level) => tree.filter((node) => node.level === level).length
  )

  const suggestionAvailable =
    hierarchyMode === 'none' &&
    SUGGESTED_LEVELS.every((i) => LAB_COLUMNS[i] !== undefined)

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/40 px-4 py-2">
        <p className="text-sm font-medium">How do the rows relate?</p>
        <p className="text-xs text-muted-foreground">
          Only you know how your sheet is laid out — nothing is nested unless
          you say so.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Suggested, never applied. Accepting is one click; ignoring it costs nothing and
            leaves the import flat, which is the safe default. */}
        {suggestionAvailable && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
            <Lightbulb className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="flex-1 text-sm">
              <span className="font-medium">Building</span>,{' '}
              <span className="font-medium">Floor</span> and{' '}
              <span className="font-medium">Room</span> repeat down the sheet —
              they may be a hierarchy.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                set({ hierarchyMode: 'levels', levels: SUGGESTED_LEVELS })
              }
            >
              Use these
            </Button>
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() =>
                set({
                  hierarchyMode: mode.id,
                  ...(mode.id === 'levels' ? {} : { levels: [] }),
                  ...(mode.id === 'keys' ? {} : { key: null, parent: null }),
                })
              }
              aria-pressed={hierarchyMode === mode.id}
              className={cn(
                'rounded-md border p-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                hierarchyMode === mode.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              )}
            >
              <p className="text-sm font-medium">{mode.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{mode.body}</p>
            </button>
          ))}
        </div>

        {hierarchyMode === 'levels' && (
          <div className="space-y-3 rounded-md bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">
                Which columns, outermost first?
              </p>
              <p className="text-xs text-muted-foreground">
                The first is the outer parent, the last is the row itself.
              </p>
            </div>

            {levels.length > 0 && (
              <ol className="space-y-1">
                {levels.map((index, position) => (
                  <li
                    key={index}
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${position * 1.25}rem` }}
                  >
                    <Badge variant="outline" className="font-normal">
                      {LAB_COLUMNS[index]?.header}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {position === 0
                        ? 'outer parent'
                        : position === levels.length - 1
                          ? 'the object each row describes'
                          : 'child of the level above'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`Remove ${LAB_COLUMNS[index]?.header}`}
                      onClick={() =>
                        set({ levels: levels.filter((l) => l !== index) })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}

            <div className="max-w-xs">
              <ColumnSelect
                value={null}
                placeholder="Add a column…"
                taken={levels}
                onChange={(v) => v !== null && set({ levels: [...levels, v] })}
              />
            </div>

            {levels.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">
                  {levels
                    .map((i) => LAB_COLUMNS[i]?.header)
                    .filter(Boolean)
                    .join(' › ')}
                </span>{' '}
                <span className="text-muted-foreground">
                  — {DATA_ROWS.length} sample rows become {tree.length} objects
                  ({perLevel.join(' + ')}). Rows repeating the same value share
                  one parent.
                </span>
              </p>
            )}
          </div>
        )}

        {hierarchyMode === 'keys' && (
          <div className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Row key</p>
              <ColumnSelect
                value={mapping.key}
                placeholder="Pick a column…"
                taken={mapping.parent !== null ? [mapping.parent] : []}
                onChange={(v) => set({ key: v })}
              />
              <p className="text-xs text-muted-foreground">
                What this row calls itself.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Parent key</p>
              <ColumnSelect
                value={mapping.parent}
                placeholder="Pick a column…"
                taken={mapping.key !== null ? [mapping.key] : []}
                onChange={(v) => set({ parent: v })}
              />
              <p className="text-xs text-muted-foreground">
                Blank in a row means it has no parent.
              </p>
            </div>
          </div>
        )}

        {hierarchyMode === 'none' && (
          <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
            <Rows3 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Every row becomes its own object with no parent.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
