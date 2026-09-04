'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Table, TableBody, TableCell, TableRow } from '@/components/ui'

import {
  DATA_START_INDEX,
  HEADER_ROW_INDEX,
  LAB_RAW_ROWS,
  LAB_WORKBOOK,
} from '../../wizard-fixtures'

/**
 * Sheet choice and header/data rows, as one step on the raw grid.
 *
 * Today these are three controls in two places — a Select above the mapper, and two number inputs
 * inside it — so you set a row number and check the result somewhere else. Clicking the row in the
 * data you are describing removes the indirection: the answer is visible where the question is.
 */
export function StepSheet({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (name: string) => void
}) {
  const [headerRow, setHeaderRow] = useState(HEADER_ROW_INDEX)
  const [dataRow, setDataRow] = useState(DATA_START_INDEX)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">
          Which sheet, and where does the data start?
        </h3>
        <p className="text-sm text-muted-foreground">
          Click a row to mark it as the header, or as the first row of data.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LAB_WORKBOOK.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            onClick={() => onSelect(sheet.name)}
            aria-pressed={selected === sheet.name}
            className={cn(
              'rounded-md border px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected === sheet.name
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <p className="text-sm font-medium">{sheet.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {sheet.rows.toLocaleString('en-US')} rows · {sheet.columns}{' '}
              columns
            </p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            Guessed row {HEADER_ROW_INDEX + 1} as the header — the first row
            where every cell is filled.
          </span>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableBody>
              {LAB_RAW_ROWS.map((row, index) => {
                const isHeader = index === headerRow
                const isFirstData = index === dataRow
                const isPreamble = index < headerRow
                return (
                  <TableRow
                    key={index}
                    className={cn(
                      isHeader && 'bg-primary/10',
                      isPreamble && 'opacity-40'
                    )}
                  >
                    <TableCell className="w-[8rem] whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 text-xs tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        {isHeader ? (
                          <Badge variant="outline" className="font-normal">
                            Header
                          </Badge>
                        ) : isFirstData ? (
                          <Badge variant="outline" className="font-normal">
                            Data starts
                          </Badge>
                        ) : (
                          <span className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setHeaderRow(index)}
                              className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              header
                            </button>
                            <button
                              type="button"
                              onClick={() => setDataRow(index)}
                              className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              data
                            </button>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className={cn(
                          'max-w-[12rem] truncate whitespace-nowrap text-sm',
                          isHeader && 'font-medium'
                        )}
                        title={cell}
                      >
                        {cell || (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">
          Rows 1–{headerRow} will be ignored. Importing{' '}
          {(1204 - dataRow).toLocaleString('en-US')} rows.
        </p>
      </div>
    </div>
  )
}
