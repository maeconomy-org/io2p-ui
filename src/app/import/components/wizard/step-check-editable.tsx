'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, CircleAlert, Pencil } from 'lucide-react'

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
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'
import type { BuildProblem } from '@/app/import/lib/build-items'

/**
 * NOT WIRED IN. An alternative Check step, kept so fix-in-place can be judged against the
 * read-only one that ships — swap it for `StepCheck` in `wizard.tsx` to try it.
 *
 * THE FORK: this edits ROWS, the shipped step shows OBJECTS. With a hierarchy on those differ —
 * `buildItems` folds every row sharing a path prefix into one object, so a building built from 40
 * rows has no single cell to edit. A row is the only unit where "click the cell and fix it" has
 * one meaning.
 *
 * STILL A DEMO: edits are local and feed nothing. Making them real means an overlay keyed by
 * (row, column), applied before `buildItems` and invalidated when the header row moves — a second
 * source of truth beside the file. That is the decision this component exists to inform.
 */

type View = 'all' | 'valid' | 'invalid'

/**
 * Which column is a problem ABOUT? `BuildProblem` names a row and a reason, not a cell, but an
 * editable grid has to put the marker somewhere — and on the whole row a 60-column sheet is
 * unfixable. Each reason has exactly one responsible column.
 */
function columnOf(problem: BuildProblem, wizard: ImportWizard): number | null {
  const kindOf = (kind: 'name' | 'key' | 'parent') => {
    const found = Object.entries(wizard.mapping.columns).find(
      ([, target]) => target.kind === kind
    )
    return found ? Number(found[0]) : null
  }

  switch (problem.key) {
    case 'import.problem.nameBlank':
      return kindOf('name')
    case 'import.problem.keyBlank':
    case 'import.problem.duplicateKey':
      return kindOf('key')
    case 'import.problem.parentUnresolved':
    case 'import.problem.parentDropped':
      return kindOf('parent')
    case 'import.problem.levelBlank': {
      // `level` is 1-based in the message, because that is how it reads to a user.
      const level = Number(problem.values?.level ?? 0) - 1
      return wizard.levels[level] ?? null
    }
    default:
      return null
  }
}

/**
 * Changed, NOT non-blank: a duplicate key and an unresolvable parent both hold text already, so
 * "has a value" hid every fault this step exists to show.
 *
 * Optimistic — any different value clears it, because edits feed nothing and `buildItems` cannot
 * be re-run against them.
 */
export function faultStands(
  original: string,
  edited: string | undefined
): boolean {
  if (edited === undefined) return true // untouched
  const next = edited.trim()
  return !next || next === original.trim()
}

export function StepCheckEditable({ wizard }: { wizard: ImportWizard }) {
  const t = useTranslations()
  const [view, setView] = useState<View>('all')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())

  const cellId = (row: number, column: number) => `${row}:${column}`

  /** Every problem, indexed by the cell it belongs to. */
  const faults = useMemo(() => {
    const map = new Map<string, BuildProblem>()
    for (const problem of wizard.problems) {
      const column = columnOf(problem, wizard)
      if (column === null) continue
      map.set(cellId(problem.row, column), problem)
    }
    return map
  }, [wizard])

  const valueOf = (row: number, column: number, original: string) =>
    edits[cellId(row, column)] ?? original

  /**
   * DERIVED, never stored: validity that is written down drifts out of step with what is on screen
   * the moment an edit is undone, and the row then reads green while still empty.
   */
  const faultOf = (row: number, column: number, original: string) => {
    const fault = faults.get(cellId(row, column))
    if (!fault) return undefined
    return faultStands(original, edits[cellId(row, column)]) ? fault : undefined
  }

  const rows = wizard.dataRows.map((cells, index) => ({
    number: wizard.dataRowNumbers[index] ?? index + 1,
    cells,
  }))

  const isValid = (row: (typeof rows)[number]) =>
    wizard.headers.every(
      (_, column) => !faultOf(row.number, column, row.cells[column] ?? '')
    )

  const invalid = rows.filter((row) => !isValid(row))
  const visible =
    view === 'valid'
      ? rows.filter(isValid)
      : view === 'invalid'
        ? invalid
        : rows

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{t('import.check.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('import.check.subtitle')}
          </p>
        </div>

        {/* The counts sit WITH the filter, so switching views never leaves a number behind that
            refers to a different set — the mistake the two selection counters made on /objects. */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(next) => next && setView(next as View)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all" className="gap-1.5">
            {t('import.check.filter.all')}
            <span className="tabular-nums text-muted-foreground">
              {rows.length}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="valid" className="gap-1.5">
            {t('import.check.filter.valid')}
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
              {rows.length - invalid.length}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="invalid" className="gap-1.5">
            {t('import.check.filter.needsFix')}
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
          <p className="text-sm">{t('import.check.allClear')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
          <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm">
            {t('import.check.fixOrSkip', { count: invalid.length })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSkipped(new Set(invalid.map((row) => row.number)))
            }
          >
            {t('import.check.skipRows', { count: invalid.length })}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[5rem]">
                {t('import.check.columns.row')}
              </TableHead>
              {wizard.headers.map((header, column) => (
                <TableHead key={column} className="whitespace-nowrap">
                  {header ||
                    t('import.map.unnamedColumn', { index: column + 1 })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const valid = isValid(row)
              const hadFault = wizard.headers.some((_, column) =>
                faults.has(cellId(row.number, column))
              )
              return (
                <TableRow
                  key={row.number}
                  className={cn(
                    !valid && 'bg-destructive/5',
                    // Fixed rows go green rather than merely losing their red, so the work done
                    // is visible in a list that may be hundreds of rows long.
                    hadFault &&
                      valid &&
                      'bg-emerald-50/60 dark:bg-emerald-950/30',
                    skipped.has(row.number) && 'opacity-40 line-through'
                  )}
                >
                  <TableCell className="whitespace-nowrap align-top text-xs tabular-nums text-muted-foreground">
                    {row.number}
                  </TableCell>

                  {wizard.headers.map((_, column) => {
                    const original = row.cells[column] ?? ''
                    const id = cellId(row.number, column)
                    const fault = faultOf(row.number, column, original)
                    const value = valueOf(row.number, column, original)

                    return (
                      <TableCell
                        key={column}
                        className="max-w-[15rem] align-top"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {fault && (
                              <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                            {editing === id ? (
                              <Input
                                autoFocus
                                defaultValue={value}
                                aria-label={`${wizard.headers[column]} — row ${row.number}`}
                                className="h-7 text-sm"
                                onBlur={(event) => {
                                  setEdits((prev) => ({
                                    ...prev,
                                    [id]: event.target.value,
                                  }))
                                  setEditing(null)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter')
                                    event.currentTarget.blur()
                                  if (event.key === 'Escape') setEditing(null)
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
                                      fault
                                        ? 'text-muted-foreground/60'
                                        : 'text-muted-foreground/30'
                                    )}
                                  >
                                    {fault ? t('import.check.empty') : '—'}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                          {fault && (
                            <p className="pl-1 text-xs text-destructive">
                              {t(fault.key, fault.values)}
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
        {t('import.check.editsAreLocal')}
      </p>
    </div>
  )
}
