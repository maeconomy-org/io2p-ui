'use client'

import { AlertTriangle, MapPin, Split } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

import type { LabColumn, LabMapping } from '../../wizard-fixtures'
import { HierarchyPanel } from './hierarchy-panel'
import {
  DELIMITERS,
  LAB_COLUMNS,
  LAB_DESTINATIONS,
  deriveKey,
  faithfulSlug,
  parseAddress,
} from '../../wizard-fixtures'

const NONE = 'none'

function SourceSelect({
  value,
  onChange,
  taken,
  placeholder = 'Not mapped',
}: {
  value: number | null
  onChange: (next: number | null) => void
  taken: number[]
  placeholder?: string
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

function FieldRow({
  label,
  hint,
  required,
  children,
  preview,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  preview?: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[13rem_1fr_1.2fr] md:items-center">
      <div>
        <p className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
      <div className="min-w-0">{preview}</div>
    </div>
  )
}

/**
 * The address preview is the whole argument for parsing rather than asking for five columns.
 *
 * A sheet almost always carries one address cell. Splitting it is OUR job, and it has to be
 * visible because the risky part is silent: io2p stores a 2-letter ISO country code, and
 * "United States" is not one. Translating it in the mapper is the difference between an import
 * that works and 1,200 rows failing on `address.country`.
 */
function AddressPreview({ sample }: { sample: string }) {
  const parsed = parseAddress(sample)

  if (!parsed.confident && !parsed.street) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Could not split this — it will import as one unstructured address.
      </p>
    )
  }

  const parts = [
    { label: 'no.', value: parsed.houseNumber },
    { label: 'street', value: parsed.street },
    { label: 'city', value: parsed.city },
    { label: 'state', value: parsed.state },
    { label: 'postcode', value: parsed.postalCode },
    { label: 'country', value: parsed.country },
  ].filter((p) => p.value)

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {parts.map((part) => (
          <Badge
            key={part.label}
            variant="secondary"
            className="font-normal"
            title={part.label}
          >
            {part.value}
          </Badge>
        ))}
      </div>
      {parsed.countryWasName && (
        <p className="text-xs text-muted-foreground">
          Country read as{' '}
          <code className="rounded bg-muted px-1">{parsed.countryWasName}</code>{' '}
          → stored as{' '}
          <code className="rounded bg-muted px-1">{parsed.country}</code>
        </p>
      )}
      {!parsed.confident && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Partial match — check the result before importing.
        </p>
      )}
    </div>
  )
}

/**
 * Where the imported tree hangs — a CONSTANT applied to every root, not a column mapping.
 *
 * It needs no protocol surface at all: core's envelope already accepts a real entity id in
 * `parents[]` beside tempIds from the same job, so a destination is that id on the top-level
 * items. It also answers a question the old importer could not — everything landed at the root
 * and had to be re-parented by hand afterwards.
 */
function DestinationPanel({
  value,
  onChange,
  nested,
}: {
  value: string | null
  onChange: (next: string | null) => void
  nested: boolean
}) {
  const chosen = LAB_DESTINATIONS.find((d) => d.id === value)

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/40 px-4 py-2">
        <p className="text-sm font-medium">Where do these go?</p>
      </div>
      <div className="grid gap-3 px-4 py-3 md:grid-cols-[13rem_1fr_1.2fr] md:items-center">
        <div>
          <p className="text-sm font-medium">Create under</p>
          <p className="text-xs text-muted-foreground">Optional</p>
        </div>
        <Select
          value={value ?? NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Top level</SelectItem>
            {LAB_DESTINATIONS.map((destination) => (
              <SelectItem key={destination.id} value={destination.id}>
                {destination.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {destination.path}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {chosen ? (
            <>
              {nested ? 'Each top-level object' : 'Every object'} becomes a
              child of{' '}
              <span className="font-medium text-foreground">{chosen.name}</span>
              {nested && '. Everything below keeps its own parent.'}
            </>
          ) : (
            'Objects are created at the root, alongside everything else you own.'
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * Which level a column describes. Only meaningful once a hierarchy exists — before that every
 * column describes the row, and there is only one kind of row.
 */
function AttachSelect({
  levels,
  value,
  onChange,
}: {
  levels: number[]
  value: number
  onChange: (level: number) => void
}) {
  if (levels.length < 2) return null
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-7 w-auto gap-1 border-none px-2 text-xs text-muted-foreground shadow-none">
        <span>on</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {levels.map((column, level) => (
          <SelectItem key={column} value={String(level)}>
            {LAB_COLUMNS[column]?.header}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function StepMap({
  mapping,
  onChange,
}: {
  mapping: LabMapping
  onChange: (next: LabMapping) => void
}) {
  const set = (patch: Partial<LabMapping>) => onChange({ ...mapping, ...patch })

  const claimed = [
    mapping.name,
    mapping.description,
    mapping.address,
    mapping.files,
    ...mapping.levels,
    mapping.key,
    mapping.parent,
    ...Object.values(mapping.addressParts),
  ].filter((v): v is number => v !== null && v !== undefined)

  // Anything a fixed field did NOT claim becomes a property. A column can therefore never be
  // silently dropped — today an unmapped header just vanishes with no trace on any screen.
  const propertyColumns = LAB_COLUMNS.filter((c) => !claimed.includes(c.index))

  const namedByLevels =
    mapping.hierarchyMode === 'levels' && mapping.levels.length > 0
  const splitAddress = Object.keys(mapping.addressParts).length > 0

  const addressColumn = LAB_COLUMNS.find((c) => c.index === mapping.address)

  const activeLevels = mapping.hierarchyMode === 'levels' ? mapping.levels : []
  const deepest = Math.max(0, activeLevels.length - 1)
  const attachOf = (column: number) => mapping.attachTo[column] ?? deepest
  const setAttach = (column: number, level: number) =>
    set({ attachTo: { ...mapping.attachTo, [column]: level } })

  const setProperty = (
    index: number,
    patch: Partial<{ include: boolean; split: string | null }>
  ) =>
    set({
      properties: {
        ...mapping.properties,
        [index]: {
          ...{ include: true, split: null },
          ...mapping.properties[index],
          ...patch,
        },
      },
    })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Where does each column go?</h3>
        <p className="text-sm text-muted-foreground">
          Fill the fields an object always has. Everything left over becomes a
          property.
        </p>
      </div>

      {!namedByLevels && mapping.name === null && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nothing gives objects a name. Map a column to Name, or use hierarchy
            levels.
          </AlertDescription>
        </Alert>
      )}

      <DestinationPanel
        value={mapping.destination}
        onChange={(destination) => set({ destination })}
        nested={mapping.levels.length > 0}
      />

      <HierarchyPanel mapping={mapping} onChange={onChange} />

      {/* ── Zone 1: the fixed shape. Target-first, because these targets always exist. ── */}
      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted/40 px-4 py-2">
          <p className="text-sm font-medium">Object fields</p>
        </div>
        <div className="divide-y">
          <FieldRow
            label="Name"
            required
            hint={namedByLevels ? 'From the hierarchy' : undefined}
            preview={
              namedByLevels ? (
                <p className="text-xs text-muted-foreground">
                  Each level&apos;s cell is that object&apos;s name.
                </p>
              ) : null
            }
          >
            {namedByLevels ? (
              <p className="text-sm text-muted-foreground">
                {mapping.levels
                  .map((i) => LAB_COLUMNS[i]?.header)
                  .filter(Boolean)
                  .join(' › ')}
              </p>
            ) : (
              <SourceSelect
                value={mapping.name}
                onChange={(v) => set({ name: v })}
                taken={claimed}
              />
            )}
          </FieldRow>

          <FieldRow label="Description">
            <SourceSelect
              value={mapping.description}
              onChange={(v) => set({ description: v })}
              taken={claimed}
            />
          </FieldRow>

          <FieldRow
            label="Address"
            hint="One column — we split it"
            preview={
              addressColumn ? (
                <AddressPreview sample={addressColumn.samples[0] ?? ''} />
              ) : null
            }
          >
            <div className="space-y-2">
              <SourceSelect
                value={mapping.address}
                onChange={(v) => set({ address: v })}
                taken={claimed}
              />
              {mapping.address !== null && (
                <AttachSelect
                  levels={activeLevels}
                  value={attachOf(mapping.address)}
                  onChange={(level) => setAttach(mapping.address!, level)}
                />
              )}
              <button
                type="button"
                onClick={() =>
                  set({
                    addressParts: splitAddress ? {} : { street: -1 },
                    address: splitAddress ? mapping.address : null,
                  })
                }
                className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <MapPin className="h-3 w-3" />
                {splitAddress
                  ? 'It is in one column'
                  : 'It is split across columns'}
              </button>
            </div>
          </FieldRow>

          <FieldRow label="File links" hint="A column of URLs">
            <SourceSelect
              value={mapping.files}
              onChange={(v) => set({ files: v })}
              taken={claimed}
            />
          </FieldRow>
        </div>
      </div>

      {/* ── Zone 2: the open half. Source-first, because these targets do not exist yet. ── */}
      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
          <div>
            <p className="text-sm font-medium">Properties</p>
            <p className="text-xs text-muted-foreground">
              {propertyColumns.length} column
              {propertyColumns.length === 1 ? '' : 's'} left over
            </p>
          </div>
          <Button type="button" variant="outline" size="sm">
            Save as mapping
          </Button>
        </div>
        <div className="divide-y">
          {propertyColumns.map((column) => {
            const state = mapping.properties[column.index] ?? {
              include: true,
              split: null,
            }
            const key = deriveKey(column.header)
            // Mangled means characters were REMOVED, not merely that spaces became underscores.
            // Comparing against the faithful slug keeps `Year Built` quiet and flags `Area (m²)`.
            const mangled = key !== faithfulSlug(column.header)
            return (
              <PropertyRow
                key={column.index}
                column={column}
                include={state.include}
                split={state.split}
                propertyKey={key}
                mangled={mangled}
                levels={activeLevels}
                attachTo={attachOf(column.index)}
                onAttach={(level) => setAttach(column.index, level)}
                onToggle={() =>
                  setProperty(column.index, { include: !state.include })
                }
                onSplit={(split) => setProperty(column.index, { split })}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PropertyRow({
  column,
  include,
  split,
  propertyKey,
  mangled,
  levels,
  attachTo,
  onAttach,
  onToggle,
  onSplit,
}: {
  column: LabColumn
  include: boolean
  split: string | null
  propertyKey: string
  mangled: boolean
  levels: number[]
  attachTo: number
  onAttach: (level: number) => void
  onToggle: () => void
  onSplit: (split: string | null) => void
}) {
  const sample = column.samples[0] ?? ''
  const values = split ? sample.split(split).map((v) => v.trim()) : [sample]

  return (
    <div
      className={cn(
        'grid gap-3 px-4 py-3 md:grid-cols-[13rem_1fr_1.2fr] md:items-center',
        !include && 'opacity-50'
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{column.header}</p>
        <p className="text-xs text-muted-foreground">
          key{' '}
          <code
            className={cn(
              'rounded bg-muted px-1',
              mangled && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {propertyKey}
          </code>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Select
          value={split ?? 'none'}
          onValueChange={(v) => onSplit(v === 'none' ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DELIMITERS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AttachSelect levels={levels} value={attachTo} onChange={onAttach} />
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Splitting is the only way to reach the model's multi-value bucket from a spreadsheet,
            and it is unreachable today — so the result has to be visible, not implied. */}
        <div className="flex min-w-0 flex-wrap gap-1">
          {values.map((value, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="max-w-[12rem] truncate font-normal"
              title={value}
            >
              {value}
            </Badge>
          ))}
          {values.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Split className="h-3 w-3" />
              {values.length} values
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {include ? 'Skip' : 'Include'}
        </Button>
      </div>
    </div>
  )
}
