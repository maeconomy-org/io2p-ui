'use client'

import { AlertTriangle, CornerDownRight } from 'lucide-react'

import {
  Alert,
  AlertDescription,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import type { ImportWizard } from '@/hooks/import/use-import-wizard'

/**
 * The last screen before anything is written, and the reason it exists: the node's store is
 * append-only, so a mis-mapped import can only be soft-deleted afterwards, never removed.
 *
 * It shows the OBJECTS, not the rows. With a hierarchy on those are different things — 1,200 rows
 * become 1,847 objects — so reviewing the rows would mean reviewing something that is not what
 * gets created. Every number here comes from the same `buildItems` that produces the payload, so
 * nothing on this screen can disagree with what is sent.
 */

const PREVIEW_LIMIT = 40

interface Row {
  tempId: string
  name: string
  depth: number
  properties: number
  values: number
  hasAddress: boolean
  files: number
}

function toRows(wizard: ImportWizard): Row[] {
  const depthOf = new Map<string, number>()

  return wizard.items.map((item) => {
    const body = item.body as {
      name: string
      parents?: string[]
      address?: unknown
      properties?: { values: unknown[] }[]
      files?: unknown[]
    }
    // A parent inside this job is another item's tempId. A real object id (the destination) is
    // not part of this tree, so it adds no depth — hence the `?? -1` fallback.
    const parent = body.parents?.[0]
    const depth = parent ? (depthOf.get(parent) ?? -1) + 1 : 0
    depthOf.set(item.tempId ?? '', depth)

    return {
      tempId: item.tempId ?? '',
      name: body.name,
      depth,
      properties: body.properties?.length ?? 0,
      values:
        body.properties?.reduce((sum, p) => sum + p.values.length, 0) ?? 0,
      hasAddress: Boolean(body.address),
      files: body.files?.length ?? 0,
    }
  })
}

export function StepCheck({ wizard }: { wizard: ImportWizard }) {
  const rows = toRows(wizard)
  const shown = rows.slice(0, PREVIEW_LIMIT)
  const depth = rows.reduce((max, row) => Math.max(max, row.depth), 0) + 1
  const totalValues = rows.reduce((sum, row) => sum + row.values, 0)

  const stats = [
    {
      label: 'objects',
      value: wizard.items.length,
      hint: `from ${wizard.dataRows.length.toLocaleString('en-US')} rows`,
    },
    { label: 'levels deep', value: depth, hint: 'hierarchy' },
    { label: 'values', value: totalValues, hint: 'across all properties' },
    {
      label: 'problems',
      value: wizard.problems.length,
      hint: wizard.problems.length === 0 ? 'none' : 'rows refused',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Check what will be created</h3>
        <p className="text-sm text-muted-foreground">
          Nothing has been written yet. These are the objects, not the rows.
          {/* Named here as well as on the mapping step: it decides WHERE the whole tree lands,
              and this is the last screen before that becomes permanent. */}
          {wizard.destination &&
            ' They will be created under the object you chose.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border p-3">
            <p className="text-2xl font-semibold tabular-nums">
              {stat.value.toLocaleString('en-US')}
            </p>
            <p className="text-sm">{stat.label}</p>
            <p className="text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      {/* Refused rows are named HERE, before the import, because this is the only place the row
          NUMBER is still known — the node never sees the spreadsheet. */}
      {wizard.problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">
              {wizard.problems.length} row
              {wizard.problems.length === 1 ? '' : 's'} will be skipped
            </p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {wizard.problems.slice(0, 5).map((problem, index) => (
                <li key={index}>
                  {problem.row > 0 && (
                    <span className="tabular-nums">Row {problem.row}: </span>
                  )}
                  {problem.message}
                </li>
              ))}
              {wizard.problems.length > 5 && (
                <li className="text-muted-foreground">
                  …and {wizard.problems.length - 5} more
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Object</TableHead>
              <TableHead className="w-[9rem]">Properties</TableHead>
              <TableHead className="w-[6rem]">Address</TableHead>
              <TableHead className="w-[5rem]">Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.tempId}>
                <TableCell>
                  {/* Indentation IS the hierarchy. A flat list of 1,847 names says nothing about
                      whether the tree came out the way the operator intended. */}
                  <div
                    className="flex min-w-0 items-center gap-1.5"
                    style={{ paddingLeft: `${row.depth * 1.25}rem` }}
                  >
                    {row.depth > 0 && (
                      <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className="truncate font-medium">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {row.properties === 0 ? (
                    '—'
                  ) : (
                    <>
                      {row.properties}
                      {row.values > row.properties && (
                        <span className="text-xs"> ({row.values} values)</span>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {row.hasAddress ? (
                    <Badge variant="outline" className="font-normal">
                      yes
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {row.files || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rows.length > PREVIEW_LIMIT && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Showing the first {PREVIEW_LIMIT} of{' '}
          {rows.length.toLocaleString('en-US')} objects.
        </p>
      )}
    </div>
  )
}
