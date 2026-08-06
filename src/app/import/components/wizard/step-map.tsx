'use client'

import { useState } from 'react'
import { FolderTree, Layers, Sparkles, X } from 'lucide-react'

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { ObjectPicker } from '@/components/entity-sheet/fields'
import { cn } from '@/lib/utils'
import type { ColumnTarget } from '@/lib/import/build-items'
import { deriveKey } from '@/lib/import/build-items'
import type {
  ImportWizard,
  WizardColumn,
} from '@/hooks/import/use-import-wizard'

/**
 * One screen, one decision per column: what does this column become?
 *
 * The old mapper split this across a Select above the table and two number inputs inside it, so
 * you set a value in one place and checked the result in another. Here every column is a row
 * carrying its own header, its real sample values and its target — the question and the evidence
 * for answering it are in the same line.
 *
 * A column is never silently dropped. Anything not claimed by a field falls through to a
 * property, which is one click to remove and visible while you decide; an unmapped column is data
 * the operator brought and the import threw away without saying so.
 */

const TARGETS = [
  { value: 'skip', label: "Don't import" },
  { value: 'name', label: 'Name' },
  { value: 'description', label: 'Description' },
  { value: 'property', label: 'Property' },
  { value: 'address', label: 'Address (whole cell)' },
  { value: 'address.street', label: 'Address — street' },
  { value: 'address.houseNumber', label: 'Address — number' },
  { value: 'address.postalCode', label: 'Address — postcode' },
  { value: 'address.city', label: 'Address — city' },
  // `state` is part of the address model and was the one part with no way to map it: a sheet with
  // a province or Bundesland column had to drop it or file it as an ordinary property.
  { value: 'address.state', label: 'Address — state / province' },
  { value: 'address.country', label: 'Address — country' },
  { value: 'fileUrl', label: 'File link' },
  { value: 'key', label: 'Key (this row’s id)' },
  { value: 'parent', label: 'Parent key' },
] as const

const SPLITS = [
  { value: 'none', label: 'One value' },
  { value: ';', label: 'Split on ;' },
  { value: ',', label: 'Split on ,' },
  { value: '|', label: 'Split on |' },
]

function targetValue(target: ColumnTarget | undefined): string {
  if (!target) return 'skip'
  if (target.kind === 'addressPart') return `address.${target.part}`
  return target.kind
}

function toTarget(value: string, column: WizardColumn): ColumnTarget | null {
  if (value === 'skip') return null
  if (value.startsWith('address.')) {
    return {
      kind: 'addressPart',
      part: value.slice('address.'.length) as 'street',
    }
  }
  if (value === 'property') {
    return {
      kind: 'property',
      key: deriveKey(column.header),
      label: column.header,
      split: null,
    }
  }
  return { kind: value as 'name' }
}

function ColumnRow({
  column,
  wizard,
}: {
  column: WizardColumn
  wizard: ImportWizard
}) {
  const target = wizard.mapping.columns[column.index]
  const isLevel = wizard.levels.includes(column.index)
  const levelIndex = wizard.levels.indexOf(column.index)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{column.header}</span>
          {isLevel && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Layers className="h-3 w-3" />
              Level {levelIndex + 1}
            </Badge>
          )}
        </div>
        {/* The real first values, not a placeholder. A mapping decision is impossible without
            seeing what is actually in the column. */}
        <p className="truncate text-xs text-muted-foreground">
          {column.samples.join(' · ') || 'no values in this column'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {target?.kind === 'property' && (
          <Select
            value={target.split ?? 'none'}
            onValueChange={(value) =>
              wizard.setColumn(column.index, {
                ...target,
                split: value === 'none' ? null : value,
              })
            }
          >
            <SelectTrigger className="h-8 w-[9rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPLITS.map((split) => (
                <SelectItem key={split.value} value={split.value}>
                  {split.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Which level a value belongs to. Only meaningful once a hierarchy exists, and only for
            a column that is not itself a level. */}
        {wizard.levels.length > 0 && !isLevel && target && (
          <Select
            value={String(wizard.attachTo[column.index] ?? 'deepest')}
            onValueChange={(value) =>
              wizard.setAttachTo((current) => {
                const next = { ...current }
                if (value === 'deepest') delete next[column.index]
                else next[column.index] = Number(value)
                return next
              })
            }
          >
            <SelectTrigger className="h-8 w-[10rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepest">on the deepest level</SelectItem>
              {wizard.levels.map((levelColumn, index) => (
                <SelectItem key={levelColumn} value={String(index)}>
                  on {wizard.headers[levelColumn] || `level ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          size="sm"
          variant={isLevel ? 'secondary' : 'ghost'}
          className="h-8 px-2 text-xs"
          onClick={() => wizard.toggleLevel(column.index)}
        >
          <Layers className="mr-1 h-3 w-3" />
          {isLevel ? 'Level' : 'Make level'}
        </Button>

        <Select
          value={targetValue(target)}
          onValueChange={(value) =>
            wizard.setColumn(column.index, toTarget(value, column))
          }
        >
          <SelectTrigger className="h-8 w-[13rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/**
 * Where the imported tree lands.
 *
 * This needs no new protocol surface, which is why it is a picker and not a feature: core's
 * envelope already accepts a REAL object id in `parents[]` alongside the tempIds from the same
 * job, so a destination is just that id on every root item. Everything below a root keeps
 * hanging off its own parent.
 *
 * Reuses the same ObjectPicker as the entity sheet and the bulk-parent dialog — one search, one
 * set of access rules. The node refuses a parent the caller cannot READ, so a picker that
 * searched differently here could offer something the import would then reject.
 */
function DestinationField({ wizard }: { wizard: ImportWizard }) {
  const [name, setName] = useState<string>()

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3">
      <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Import under an existing object</p>
        <p className="text-xs text-muted-foreground">
          {wizard.destination
            ? `Every top-level object will be created inside ${name ?? 'the chosen object'}.`
            : 'Optional — leave empty to create them at the top level.'}
        </p>
      </div>
      <ObjectPicker
        value={wizard.destination ?? ''}
        displayName={name}
        placeholder="Choose a parent…"
        className="w-[16rem]"
        onSelect={(id, picked) => {
          setName(picked)
          wizard.setDestination(id)
        }}
      />
      {wizard.destination && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Clear destination"
          onClick={() => {
            setName(undefined)
            wizard.setDestination(null)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

export function StepMap({ wizard }: { wizard: ImportWizard }) {
  const unusedSuggestion = wizard.suggestedLevels.filter(
    (column) => !wizard.levels.includes(column)
  )
  const hasSuggestion =
    wizard.levels.length === 0 && unusedSuggestion.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">What is in each column?</h3>
        <p className="text-sm text-muted-foreground">
          Guessed from your headers and the values themselves — change anything
          that is wrong.
        </p>
      </div>

      {/* OFFERED, never applied. Accepting this changes how many objects get created, which is
          too consequential to arrive as a decision already made. */}
      {hasSuggestion && (
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm">
              These columns repeat down the sheet, so they may describe a
              hierarchy:{' '}
              <span className="font-medium">
                {unusedSuggestion
                  .map((c) => wizard.headers[c] || `Column ${c + 1}`)
                  .join(' › ')}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => wizard.setLevels(unusedSuggestion)}
            >
              Use as hierarchy
            </Button>
          </div>
        </div>
      )}

      {wizard.levels.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {wizard.levels
                .map((c) => wizard.headers[c] || `Column ${c + 1}`)
                .join(' › ')}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {wizard.dataRows.length.toLocaleString('en-US')} rows become{' '}
              {wizard.items.length.toLocaleString('en-US')} objects
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => wizard.setLevels([])}
          >
            Clear hierarchy
          </Button>
        </div>
      )}

      <div className={cn('divide-y rounded-md border')}>
        {wizard.columns.map((column) => (
          <ColumnRow key={column.index} column={column} wizard={wizard} />
        ))}
      </div>

      <DestinationField wizard={wizard} />
    </div>
  )
}
