'use client'

import { useState } from 'react'
import { Check, CircleAlert, CornerDownRight, Pencil } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui'

import type { LabMapping } from '../../wizard-fixtures'
import {
  DATA_ROWS,
  DATA_START_INDEX,
  LAB_COLUMNS,
  buildTree,
  deriveKey,
  parseAddress,
  rowRange,
} from '../../wizard-fixtures'

type View = 'all' | 'valid' | 'invalid'

interface ResultCell {
  value: string
  problem?: string
}

interface ResultRow {
  path: string
  from: string
  level: number
  name: string
  cells: Record<string, ResultCell>
}

/**
 * Two seeded faults, keyed by PATH so they survive a re-shaped tree. Real problems will come from
 * core's dry-run; these exist so the fix-in-place flow has something to fix.
 */
const SEEDED: Record<string, { column: string; problem: string }> = {
  'Northgate House/Ground/102': {
    column: 'area_m²',
    problem: 'Empty — a value needs data',
  },
  'Riverside Depot': {
    column: 'Address',
    problem: 'No city or postcode found — will import unstructured',
  },
}

/**
 * The result grid, DERIVED from the mapping rather than fixed.
 *
 * Everything here is recomputed from the same `buildTree` the hierarchy panel counts with, so the
 * two can never disagree. A static fixture kept showing a nested tree after "One row, one object"
 * was chosen — a preview that ignores the choice it is previewing.
 */
function buildRows(mapping: LabMapping): {
  rows: ResultRow[]
  columns: string[]
} {
  const levels = mapping.hierarchyMode === 'levels' ? mapping.levels : []
  const tree = buildTree(levels)
  const deepest = Math.max(0, levels.length - 1)

  const propertyColumns = Object.entries(mapping.properties)
    .filter(([, state]) => state.include)
    .map(([index]) => Number(index))
    .filter((index) => !levels.includes(index))

  const columns = [
    'Name',
    ...(mapping.address !== null ? ['Address'] : []),
    ...propertyColumns.map((i) => deriveKey(LAB_COLUMNS[i]?.header ?? '')),
    ...(mapping.files !== null ? ['Files'] : []),
  ]

  // Which level a column lands on: the operator's choice, else the deepest — core's own default.
  const levelFor = (column: number) => mapping.attachTo[column] ?? deepest

  const rows = tree.map((node) => {
    const sourceRow =
      DATA_ROWS[(node.rows[0] ?? 1) - DATA_START_INDEX - 1] ?? []
    const cells: Record<string, ResultCell> = {
      Name: { value: node.name },
    }

    if (mapping.address !== null) {
      const raw = sourceRow[mapping.address] ?? ''
      const parsed = parseAddress(raw)
      cells.Address = {
        value:
          levelFor(mapping.address) === node.level
            ? parsed.confident
              ? `${parsed.houseNumber ?? ''} ${parsed.street ?? ''}, ${parsed.city ?? ''} ${parsed.state ?? ''} ${parsed.postalCode ?? ''}, ${parsed.country ?? ''}`.trim()
              : raw
            : '',
      }
    }

    propertyColumns.forEach((index) => {
      const key = deriveKey(LAB_COLUMNS[index]?.header ?? '')
      const split = mapping.properties[index]?.split ?? null
      const raw = sourceRow[index] ?? ''
      const shown =
        levelFor(index) === node.level
          ? split
            ? raw
                .split(split)
                .map((v) => v.trim())
                .filter(Boolean)
                .join(' · ')
            : raw
          : ''
      cells[key] = { value: shown }
    })

    if (mapping.files !== null) {
      cells.Files = {
        value:
          levelFor(mapping.files) === node.level && sourceRow[mapping.files]
            ? '1 link'
            : '',
      }
    }

    const seeded = SEEDED[node.path]
    if (seeded && cells[seeded.column]) {
      cells[seeded.column] = { value: '', problem: seeded.problem }
    }

    return {
      path: node.path,
      from: rowRange(node.rows),
      level: node.level,
      name: node.name,
      cells,
    }
  })

  return { rows, columns }
}

export function StepCheck({ mapping }: { mapping: LabMapping }) {
  const [view, setView] = useState<View>('all')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)

  const { rows, columns } = buildRows(mapping)
  const cellId = (path: string, column: string) => `${path}:${column}`

  const valueOf = (row: ResultRow, column: string) =>
    edits[cellId(row.path, column)] ?? row.cells[column]?.value ?? ''

  // A problem survives only until its cell is given a value — validity is DERIVED from the edits
  // rather than stored, so it cannot drift out of step with what is on screen.
  const problemOf = (row: ResultRow, column: string) => {
    const declared = row.cells[column]?.problem
    if (!declared) return undefined
    return valueOf(row, column).trim() ? undefined : declared
  }

  const rowIsValid = (row: ResultRow) =>
    columns.every((column) => !problemOf(row, column))

  const invalid = rows.filter((row) => !rowIsValid(row))
  const visible =
    view === 'valid'
      ? rows.filter(rowIsValid)
      : view === 'invalid'
        ? invalid
        : rows

  const nested = mapping.hierarchyMode === 'levels' && mapping.levels.length > 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">What will be created</h3>
          <p className="text-sm text-muted-foreground">
            {DATA_ROWS.length} sample rows become{' '}
            <span className="font-medium text-foreground">
              {rows.length} objects
            </span>
            {nested ? ', nested' : ', flat'}. Click any cell to correct it.
          </p>
        </div>

        {/* The counts sit WITH the filter, so switching views never leaves a number behind that
            refers to a different set — the mistake the two selection counters made on /objects. */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as View)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all" className="gap-1.5">
            All
            <span className="tabular-nums text-muted-foreground">
              {rows.length}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="valid" className="gap-1.5">
            Valid
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
              {rows.length - invalid.length}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="invalid" className="gap-1.5">
            Needs a fix
            <span
              className={cn(
                'tabular-nums',
                invalid.length > 0
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              )}
            >
              {invalid.length}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {invalid.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm">Everything checks out. Ready to import.</p>
        </div>
      ) : (
        view === 'invalid' && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
            <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm">
              Fill the highlighted cells, or leave these {invalid.length} rows
              out of the import.
            </p>
            <Button type="button" variant="outline" size="sm">
              Skip {invalid.length} rows
            </Button>
          </div>
        )
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[9rem]">From</TableHead>
              {columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const valid = rowIsValid(row)
              const hadProblem = columns.some((c) => row.cells[c]?.problem)
              return (
                <TableRow
                  key={row.path}
                  className={cn(
                    !valid && 'bg-destructive/5',
                    hadProblem &&
                      valid &&
                      'bg-emerald-50/60 dark:bg-emerald-950/30'
                  )}
                >
                  {/* Sheet rows as a RANGE, because a parent object is a dedupe of every row
                      that repeated its value — attributing it to one line would be wrong. */}
                  <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                    {row.from}
                  </TableCell>

                  {columns.map((column) => {
                    const id = cellId(row.path, column)
                    const problem = problemOf(row, column)
                    const value = valueOf(row, column)
                    const isName = column === 'Name'

                    return (
                      <TableCell
                        key={column}
                        className="max-w-[15rem] align-top"
                        style={
                          isName
                            ? { paddingLeft: `${row.level * 1.1 + 1}rem` }
                            : undefined
                        }
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {/* Depth is drawn, not labelled. "L3" was jargon for something
                                indentation says without a legend. */}
                            {isName && row.level > 0 && (
                              <CornerDownRight
                                className="h-3 w-3 shrink-0 text-muted-foreground/40"
                                aria-hidden
                              />
                            )}
                            {problem && (
                              <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                            {editing === id ? (
                              <Input
                                autoFocus
                                defaultValue={value}
                                aria-label={`${column} for ${row.name}`}
                                className="h-7 text-sm"
                                onBlur={(e) => {
                                  setEdits((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                  setEditing(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur()
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditing(id)}
                                className={cn(
                                  'min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm',
                                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                                )}
                              >
                                {value || (
                                  <span
                                    className={cn(
                                      problem
                                        ? 'text-muted-foreground/60'
                                        : 'text-muted-foreground/30'
                                    )}
                                  >
                                    {problem ? 'empty' : '—'}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                          {problem && (
                            <p className="pl-1 text-xs text-destructive">
                              {problem}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        A real import runs this over every row on the server. These are the{' '}
        {DATA_ROWS.length} sample rows.
      </p>
    </div>
  )
}
