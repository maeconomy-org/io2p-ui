'use client'

import { useState } from 'react'
import {
  BarChart3,
  Hash,
  LineChart,
  PieChart,
  Plus,
  Table2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Switch,
} from '@/components/ui'

import type { Condition, Operator, Widget, WidgetKind } from '../fixtures'
import {
  FILTER_PROPERTIES,
  GROUP_FIELDS,
  MEASURE_PRESETS,
  NUMERIC_PROPERTIES,
  WIDGET_KINDS,
  measureLabel,
  totalFor,
} from '../fixtures'

const ICONS: Record<WidgetKind, typeof Hash> = {
  kpi: Hash,
  bar: BarChart3,
  donut: PieChart,
  trend: LineChart,
  table: Table2,
}

const OPERATORS: Operator[] = ['is', 'is not', 'over', 'under', 'contains']

const BLANK: Widget = {
  id: 'new',
  title: '',
  kind: 'kpi',
  span: 3,
  display: {},
  query: {
    source: 'objects',
    filter: { scope: 'all', deleted: false },
    measure: MEASURE_PRESETS[0]!.measure,
    groupBy: null,
  },
}

/**
 * Conditions edited as rows, because that is what they are.
 *
 * A single free-text filter box would need a parser and would fail silently on a typo. Three
 * bound selects cannot express a query the engine will not run.
 */
function Conditions({
  conditions,
  onChange,
  label,
}: {
  conditions: Condition[]
  onChange: (next: Condition[]) => void
  label: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {conditions.map((condition, index) => (
        <div key={index} className="flex items-center gap-1">
          <Select
            value={condition.property}
            onValueChange={(property) =>
              onChange(
                conditions.map((c, i) => (i === index ? { ...c, property } : c))
              )
            }
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_PROPERTIES.map((property) => (
                <SelectItem key={property.key} value={property.key}>
                  {property.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={condition.op}
            onValueChange={(op) =>
              onChange(
                conditions.map((c, i) =>
                  i === index ? { ...c, op: op as Operator } : c
                )
              )
            }
          >
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={condition.value}
            onValueChange={(value) =>
              onChange(
                conditions.map((c, i) => (i === index ? { ...c, value } : c))
              )
            }
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                FILTER_PROPERTIES.find((p) => p.key === condition.property)
                  ?.values ?? []
              ).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Remove condition"
            onClick={() => onChange(conditions.filter((_, i) => i !== index))}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() =>
          onChange([
            ...conditions,
            { property: 'material', op: 'is', value: 'concrete' },
          ])
        }
      >
        <Plus className="size-3" />
        Add condition
      </Button>
    </div>
  )
}

export function WidgetBuilder({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: Widget | null
  onSave: (widget: Widget) => void
}) {
  const [draft, setDraft] = useState<Widget>(initial ?? BLANK)

  const set = (patch: Partial<Widget>) => setDraft((d) => ({ ...d, ...patch }))
  const setQuery = (patch: Partial<Widget['query']>) =>
    setDraft((d) => ({ ...d, query: { ...d.query, ...patch } }))
  const setDisplay = (patch: Partial<Widget['display']>) =>
    setDraft((d) => ({ ...d, display: { ...d.display, ...patch } }))

  const { measure } = draft.query
  const grouped = draft.query.groupBy !== null

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(initial ?? BLANK)
        onOpenChange(next)
      }}
    >
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial ? 'Edit widget' : 'Add a widget'}</SheetTitle>
          <SheetDescription>
            Start from a question, or build the measure yourself.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          {/* Presets are the fast path for the questions this domain asks constantly. The
              controls below stay visible, so a preset is a starting point rather than a mode. */}
          <div className="space-y-2">
            <Label className="text-xs">Common questions</Label>
            <div className="flex flex-wrap gap-1.5">
              {MEASURE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      title: d.title || preset.label,
                      query: { ...d.query, measure: preset.measure },
                      display: { ...d.display, ...preset.display },
                    }))
                  }
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Recycled material"
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">What to measure</p>
              <Select
                value={measure.kind}
                onValueChange={(kind) =>
                  setQuery({
                    measure:
                      kind === 'ratio'
                        ? {
                            kind: 'ratio',
                            of: {
                              agg: { fn: 'sum', property: 'mass' },
                              where: [
                                {
                                  property: 'recycled',
                                  op: 'is',
                                  value: 'true',
                                },
                              ],
                            },
                            over: {
                              agg: { fn: 'sum', property: 'mass' },
                              where: [],
                            },
                          }
                        : {
                            kind: 'aggregate',
                            agg: { fn: 'count' },
                            where: [],
                          },
                  })
                }
              >
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggregate">A total</SelectItem>
                  <SelectItem value="ratio">A percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {measure.kind === 'aggregate' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aggregate</Label>
                    <Select
                      value={measure.agg.fn}
                      onValueChange={(fn) =>
                        setQuery({
                          measure: {
                            ...measure,
                            agg:
                              fn === 'count'
                                ? { fn: 'count' }
                                : {
                                    fn: fn as 'sum',
                                    property:
                                      measure.agg.fn === 'count'
                                        ? 'area'
                                        : measure.agg.property,
                                  },
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="sum">Sum of…</SelectItem>
                        <SelectItem value="avg">Average of…</SelectItem>
                        <SelectItem value="min">Minimum of…</SelectItem>
                        <SelectItem value="max">Maximum of…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {measure.agg.fn !== 'count' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Property</Label>
                      <Select
                        value={measure.agg.property}
                        onValueChange={(property) => {
                          const found = NUMERIC_PROPERTIES.find(
                            (p) => p.key === property
                          )
                          setQuery({
                            measure: {
                              ...measure,
                              agg: { fn: measure.agg.fn as 'sum', property },
                            },
                          })
                          if (found?.unit) setDisplay({ unit: found.unit })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NUMERIC_PROPERTIES.map((property) => (
                            <SelectItem key={property.key} value={property.key}>
                              {property.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Conditions
                  label="Only counting objects where"
                  conditions={measure.where}
                  onChange={(where) =>
                    setQuery({ measure: { ...measure, where } })
                  }
                />
              </>
            ) : (
              <div className="space-y-3">
                <Conditions
                  label="Share of mass where"
                  conditions={measure.of.where}
                  onChange={(where) =>
                    setQuery({
                      measure: { ...measure, of: { ...measure.of, where } },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  …out of all mass. Both sides use the same aggregate, so the
                  result is a true share rather than two unrelated numbers.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Break down by</Label>
              <Select
                value={draft.query.groupBy ?? 'none'}
                onValueChange={(v) =>
                  setQuery({ groupBy: v === 'none' ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nothing — one number</SelectItem>
                  {GROUP_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">How to show it</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {WIDGET_KINDS.map((kind) => {
                const Icon = ICONS[kind.id]
                const unavailable = kind.needsGrouping && !grouped
                return (
                  <button
                    key={kind.id}
                    type="button"
                    disabled={unavailable}
                    title={unavailable ? 'Needs a breakdown first' : kind.hint}
                    onClick={() => set({ kind: kind.id })}
                    aria-pressed={draft.kind === kind.id}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      draft.kind === kind.id
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    {kind.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* KPI-only options. Shown only for a KPI, because a bar chart has no "target". */}
          {draft.kind === 'kpi' && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Number options</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={draft.display.unit ?? ''}
                    onChange={(e) => setDisplay({ unit: e.target.value })}
                    placeholder="kg"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Decimals</Label>
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={draft.display.decimals ?? 0}
                    onChange={(e) =>
                      setDisplay({ decimals: Number(e.target.value) })
                    }
                    className="h-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm">Compare to last month</span>
                <Switch
                  checked={draft.display.comparison === 'previous'}
                  onCheckedChange={(on) =>
                    setDisplay({ comparison: on ? 'previous' : 'none' })
                  }
                  aria-label="Compare to last month"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm">Sparkline</span>
                <Switch
                  checked={Boolean(draft.display.sparkline)}
                  onCheckedChange={(sparkline) => setDisplay({ sparkline })}
                  aria-label="Show a sparkline"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target (optional)</Label>
                <Input
                  type="number"
                  value={draft.display.target ?? ''}
                  onChange={(e) =>
                    setDisplay({
                      target: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="70"
                  className="h-8"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Width</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {([3, 4, 6, 12] as const).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => set({ span })}
                  aria-pressed={draft.span === span}
                  className={cn(
                    'rounded-md border py-1.5 text-xs transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    draft.span === span
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {span === 12 ? 'Full' : `${span}/12`}
                </button>
              ))}
            </div>
          </div>

          {/* The query stated back in a sentence. Anything a builder produces should be
              readable without opening it again — that is what makes a dashboard auditable. */}
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              {measureLabel(measure)}
              {draft.query.groupBy
                ? `, broken down by ${draft.query.groupBy}`
                : ' as one number'}
              {draft.query.filter.scope !== 'all' &&
                `, limited to ${draft.query.filter.scope}`}
              .
            </p>
            <p className="pt-1 font-medium tabular-nums">
              {totalFor(draft.query).toLocaleString('en-US')}
              {draft.display.unit ? ` ${draft.display.unit}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!draft.title.trim()}
            onClick={() => {
              onSave({
                ...draft,
                id: initial?.id ?? `w${draft.title.length}${draft.kind}`,
              })
              onOpenChange(false)
            }}
          >
            {initial ? 'Save' : 'Add widget'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
