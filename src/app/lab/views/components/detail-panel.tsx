'use client'

import { useState } from 'react'
import {
  Boxes,
  Calendar,
  Check,
  FileText,
  GitBranch,
  History,
  Layers,
  Link2,
  Lock,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  Sigma,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Button, Input } from '@/components/ui'

import { SeededAvatar } from '../../components/seeded-avatar'
import { AccessTab, ActivityTab, ChildrenTab, FilesTab } from './detail-tabs'

export interface DetailRow {
  name: string
  parent: string
  type: string
  owner: string
  area: string
  cover: boolean
}

const TABS = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'properties', label: 'Properties', icon: Tag },
  { id: 'children', label: 'Children', icon: Layers },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'access', label: 'Access', icon: Shield },
  { id: 'activity', label: 'Activity', icon: History },
] as const

interface ValueFile {
  name: string
  kind: 'upload' | 'reference'
}

interface Value {
  data: string
  num?: number
  unit?: string
  parsed?: boolean
  /**
   * Files attached to THIS value, not to the object.
   *
   * io2p attaches at entity, property or value level, and the value level is the one that
   * matters most here: a photo proving a measurement belongs to the measurement, not to the
   * room. Flattening them onto the object loses which reading the evidence is for.
   */
  files?: ValueFile[]
}

interface Binding {
  expression: string
  inputs: { name: string; from: string; value: string; pinned?: string }[]
}

interface Property {
  key: string
  label: string
  /** Present when the value is computed rather than authored. */
  binding?: Binding
  values: Value[]
}

const ADDRESS = '1200 Harbor Boulevard, Portland OR 97204, US'

const INITIAL_PROPERTIES: Property[] = [
  {
    key: 'area',
    label: 'Floor area',
    values: [
      {
        data: '24 m²',
        num: 24,
        unit: 'm²',
        files: [{ name: 'measured-2026-06.pdf', kind: 'upload' }],
      },
      {
        data: '23.6 m²',
        num: 23.6,
        unit: 'm²',
        files: [
          { name: 'as-built-plan.pdf', kind: 'upload' },
          { name: 'Cadastre record', kind: 'reference' },
        ],
      },
    ],
  },
  { key: 'type', label: 'Type', values: [{ data: 'Room' }] },
  {
    key: 'use',
    label: 'Use',
    values: [{ data: 'Office' }, { data: 'Archive' }],
  },
  {
    key: 'condition',
    label: 'Condition',
    values: [
      {
        data: 'Fair',
        files: [{ name: 'inspection-2026-03.jpg', kind: 'upload' }],
      },
    ],
  },
  {
    key: 'materials',
    label: 'Materials',
    values: [{ data: 'Concrete' }, { data: 'Steel' }, { data: 'Glass' }],
  },
  {
    key: 'mass',
    label: 'Mass',
    values: [{ data: '3.26 t', num: 3260, unit: 'kg' }],
  },
  {
    key: 'co2',
    label: 'Embodied CO₂',
    binding: {
      expression: 'mass * co2_factor',
      inputs: [
        { name: 'mass', from: 'this object', value: '3,260 kg' },
        { name: 'co2_factor', from: 'constant', value: '0.42', pinned: 'v1' },
      ],
    },
    values: [{ data: '1369.2', num: 1369.2, unit: 'kg' }],
  },
  {
    key: 'inspected',
    label: 'Last inspected',
    values: [{ data: 'ca. 2024', parsed: false }],
  },
]

const OVERVIEW = [
  {
    title: 'Reusable material',
    value: '62%',
    verdict: 'Good',
    tone: 'emerald' as const,
    note: 'Share of mass here and below that is marked reusable.',
  },
  {
    title: 'Recycled content',
    value: '38%',
    verdict: 'Below target',
    tone: 'amber' as const,
    note: 'Target is 60%. 1,240 kg of 3,260 kg.',
  },
  {
    title: 'Estimated value',
    value: '€248k',
    verdict: 'Derived',
    tone: 'slate' as const,
    note: 'Rolled up across 31 descendants.',
  },
  {
    title: 'Data completeness',
    value: '84%',
    verdict: 'Fair',
    tone: 'amber' as const,
    note: '5 of 31 missing a value the template asks for.',
  },
]

const TONES = {
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  amber:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  slate: 'text-muted-foreground',
}

/**
 * Facts as icon rows, not a two-column form.
 *
 * The icon does the scanning work — someone looking for the address finds the pin before reading
 * a label. It also survives translation, where a fixed label column sized for "Floor area" will
 * not fit "Fläche".
 */
function Fact({
  icon: Icon,
  label,
  changed,
  children,
}: {
  icon: typeof MapPin
  label: string
  changed?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60',
        changed && 'border-l-2 border-primary bg-primary/5'
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="w-28 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </div>
  )
}

/**
 * One row per property, with the formula ON the property it computes.
 *
 * A separate Formulas tab put the expression somewhere other than the value it produces, so
 * answering "why is this 1369?" meant leaving the number behind. Here the `fx` chip sits beside
 * the value and expands in place — and in edit mode it opens by default, because that is exactly
 * when someone needs to see what they are not allowed to type into.
 */
function PropertyRow({
  property,
  editing,
  dirty,
  onValue,
  onAddValue,
  onRemoveValue,
  onRemove,
}: {
  property: Property
  editing: boolean
  dirty: Set<string>
  onValue: (index: number, data: string) => void
  onAddValue: () => void
  onRemoveValue: (index: number) => void
  onRemove: () => void
}) {
  const [showBinding, setShowBinding] = useState(false)
  const open = editing || showBinding

  return (
    <div className="space-y-1.5 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-medium">{property.label}</p>
        <code className="text-xs text-muted-foreground">{property.key}</code>

        {property.binding && (
          <button
            type="button"
            onClick={() => setShowBinding((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded border border-fuchsia-200 bg-fuchsia-50 px-1.5 py-0.5 text-[11px] text-fuchsia-700 transition-colors hover:bg-fuchsia-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300"
          >
            <Sigma className="size-3" />
            <code>{property.binding.expression}</code>
          </button>
        )}

        {editing && !property.binding && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-6 text-muted-foreground"
            aria-label={`Remove ${property.label}`}
            onClick={onRemove}
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>

      {/* Computed values are never typed into — the next fold would overwrite them. The field is
          replaced by the binding, which IS the editable thing. */}
      {property.binding ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {property.values.map((value, index) => (
              <span
                key={index}
                className="flex items-baseline gap-1.5 rounded border bg-muted/40 px-2 py-1 text-sm"
              >
                {value.data}
                {value.num !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    = {value.num} {value.unit}
                  </span>
                )}
                <Lock className="size-3 text-muted-foreground" />
              </span>
            ))}
          </div>

          {open && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-2">
              {property.binding.inputs.map((input) => (
                <div
                  key={input.name}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <code>{input.name}</code>
                  <span className="flex-1 truncate text-muted-foreground">
                    {input.from}
                  </span>
                  {/* The pin is the fact everyone gets wrong: a new version of a constant does
                      NOT change values already bound to an older one. */}
                  {input.pinned && (
                    <Badge variant="constant" className="font-normal">
                      pinned to {input.pinned}
                    </Badge>
                  )}
                  <span className="tabular-nums">{input.value}</span>
                </div>
              ))}
              {editing && (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 flex-1 text-xs"
                  >
                    Change binding
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 flex-1 text-xs"
                  >
                    Rebind to v2
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Values as ROWS, not chips.
           A value is a first-class thing here: it can be one of several, and it can carry its
           own files. Chips have nowhere to put either, so the moment evidence attaches to a
           reading the layout has to become a row anyway. Better one shape than two. */
        <div className="space-y-1.5">
          {property.values.map((value, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                {editing ? (
                  <Input
                    value={value.data}
                    onChange={(e) => onValue(index, e.target.value)}
                    aria-label={`${property.label} value ${index + 1}`}
                    className={cn(
                      'h-8 max-w-[16rem] text-sm',
                      dirty.has(`${property.key}[${index}]`) && 'border-primary'
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      'flex items-baseline gap-1.5 rounded border px-2 py-1 text-sm',
                      value.parsed === false &&
                        'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
                    )}
                  >
                    {value.data}
                    {value.num !== undefined && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        = {value.num} {value.unit}
                      </span>
                    )}
                    {value.parsed === false && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        not a number
                      </span>
                    )}
                  </span>
                )}

                {editing && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground"
                    >
                      <Paperclip className="size-3" />
                      Attach
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto size-7 text-muted-foreground"
                      aria-label={`Remove value ${index + 1}`}
                      onClick={() => onRemoveValue(index)}
                    >
                      <X className="size-3" />
                    </Button>
                  </>
                )}
              </div>

              {value.files && value.files.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-2">
                  {value.files.map((file) => (
                    <span
                      key={file.name}
                      className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {file.kind === 'upload' ? (
                        <Paperclip className="size-3 shrink-0" />
                      ) : (
                        <Link2 className="size-3 shrink-0" />
                      )}
                      <span className="max-w-[12rem] truncate">
                        {file.name}
                      </span>
                      {editing && (
                        <button
                          type="button"
                          aria-label={`Detach ${file.name}`}
                          className="rounded-sm hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Multi-value is the model's default, not an advanced case. */}
          {editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={onAddValue}
            >
              <Plus className="size-3" />
              Add value
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function DetailPanel({
  row,
  onClose,
}: {
  row: DetailRow
  onClose: () => void
}) {
  const [tab, setTab] = useState<string>('details')
  const [editing, setEditing] = useState(false)
  const [properties, setProperties] = useState(INITIAL_PROPERTIES)
  const [address, setAddress] = useState(ADDRESS)
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  const touch = (field: string) => setDirty((prev) => new Set(prev).add(field))

  const cancel = () => {
    setProperties(INITIAL_PROPERTIES)
    setAddress(ADDRESS)
    setDirty(new Set())
    setEditing(false)
  }

  const setValue = (key: string, index: number, data: string) => {
    setProperties((prev) =>
      prev.map((p) =>
        p.key === key
          ? {
              ...p,
              values: p.values.map((v, i) =>
                i === index ? { ...v, data } : v
              ),
            }
          : p
      )
    )
    touch(`${key}[${index}]`)
  }

  return (
    <aside
      className="flex w-[32rem] shrink-0 flex-col border-l bg-background duration-200 animate-in slide-in-from-right motion-reduce:animate-none"
      aria-label={`${row.name} details`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <span className="text-muted-foreground">Objects</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-muted-foreground">{row.parent}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate font-medium">{row.name}</span>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {!editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="More"
          >
            <MoreHorizontal className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <SeededAvatar
              seed={`${row.parent}/${row.name}`}
              square
              className="size-14"
            />
            <div className="min-w-0 flex-1">
              {editing ? (
                <Input
                  defaultValue={row.name}
                  onChange={() => touch('name')}
                  className="h-9 text-lg font-semibold"
                  aria-label="Name"
                />
              ) : (
                <h2 className="truncate text-lg font-semibold">{row.name}</h2>
              )}
              <p className="truncate pt-0.5 text-sm text-muted-foreground">
                in {row.parent}
              </p>
            </div>
          </div>

          {!editing && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Share2 className="size-3.5" />
                Share
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Add child
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <GitBranch className="size-3.5" />
                New process
              </Button>
            </div>
          )}
        </div>

        {/* Scrollbar hidden, but the overflow still has to be VISIBLE — a strip that scrolls
            with no indication reads as a strip with six tabs full stop. The right-edge fade is
            what replaces the bar it removes. */}
        <div className="relative border-b">
          <div className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tab === item.id
                      ? 'border-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
          />
        </div>

        {tab === 'details' && (
          <>
            {/* ONLY the object's own fields. If a template could add or remove it, it is a
                property — which is why `Floor area` and `Type` live in the next tab. */}
            <div className="space-y-0.5 p-2">
              <Fact icon={Layers} label="Parents">
                <span className="flex flex-wrap items-center gap-1">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {row.parent}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    Fire compartment 3
                  </span>
                  {editing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-xs"
                      onClick={() => touch('parents')}
                    >
                      <Plus className="size-3" />
                      Link
                    </Button>
                  )}
                </span>
              </Fact>

              <Fact
                icon={MapPin}
                label="Address"
                changed={dirty.has('address')}
              >
                {editing ? (
                  <Input
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value)
                      touch('address')
                    }}
                    className="h-8"
                    aria-label="Address"
                  />
                ) : (
                  address
                )}
              </Fact>

              <Fact icon={User} label="Owner">
                <span className="flex items-center gap-1.5">
                  <SeededAvatar seed={row.owner} className="size-4" />
                  {row.owner}
                </span>
              </Fact>
              <Fact icon={Calendar} label="Created">
                24 Jun 2026 by Anna Roos
              </Fact>
              <Fact icon={History} label="Version">
                <span className="tabular-nums">3</span>
                <span className="pl-1 text-xs text-muted-foreground">
                  updated 2 Aug
                </span>
              </Fact>
              <Fact icon={Tag} label="Created from">
                <Badge variant="template" className="font-normal">
                  Room
                </Badge>
              </Fact>
              <Fact icon={Boxes} label="Id">
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  0190b3f2…4d5e
                </code>
              </Fact>
            </div>

            {!editing && (
              <div className="border-t p-4">
                <div className="flex items-center gap-2 pb-3">
                  <h3 className="text-sm font-medium">Overview</h3>
                  <div className="ml-auto flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-muted-foreground"
                    >
                      <Layers className="size-3.5" />
                      Change cards
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Refresh"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Two lines, not four. The note was the tallest thing on each card and the
                    least often read — it earns a truncated line and a tooltip, which halves the
                    height of the whole section and lets four cards sit above the fold. */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {OVERVIEW.map((card) => (
                    <div
                      key={card.title}
                      title={card.note}
                      className="rounded-lg border px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        {card.title}
                      </p>
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums">
                          {card.value}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-1.5 py-0 text-[10px] font-normal',
                            TONES[card.tone]
                          )}
                        >
                          {card.verdict}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {card.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'properties' && (
          <div className="divide-y">
            {properties.map((property) => (
              <PropertyRow
                key={property.key}
                property={property}
                editing={editing}
                dirty={dirty}
                onValue={(index, data) => setValue(property.key, index, data)}
                onRemoveValue={(index) => {
                  setProperties((prev) =>
                    prev.map((p) =>
                      p.key === property.key
                        ? {
                            ...p,
                            values: p.values.filter((_, i) => i !== index),
                          }
                        : p
                    )
                  )
                  touch(property.key)
                }}
                onAddValue={() => {
                  setProperties((prev) =>
                    prev.map((p) =>
                      p.key === property.key
                        ? { ...p, values: [...p.values, { data: '' }] }
                        : p
                    )
                  )
                  touch(property.key)
                }}
                onRemove={() =>
                  setProperties((prev) =>
                    prev.filter((p) => p.key !== property.key)
                  )
                }
              />
            ))}

            {editing && (
              <div className="p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                >
                  <Plus className="size-3.5" />
                  Add a property
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === 'children' && <ChildrenTab />}
        {tab === 'files' && <FilesTab />}
        {tab === 'access' && <AccessTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>

      {/* Save-all, with a COUNT. The write is one PATCH built from a diff, so the honest thing to
          show before committing is how many changes that diff holds — "Save" alone hides whether
          a stray keystroke is about to ride along. */}
      {editing && (
        <div className="flex shrink-0 items-center gap-2 border-t p-3">
          <p className="flex-1 text-xs tabular-nums text-muted-foreground">
            {dirty.size === 0
              ? 'No changes yet'
              : `${dirty.size} change${dirty.size === 1 ? '' : 's'} to save`}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={cancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={dirty.size === 0}
            onClick={() => {
              setDirty(new Set())
              setEditing(false)
            }}
          >
            <Check className="size-3.5" />
            Save
          </Button>
        </div>
      )}
    </aside>
  )
}
