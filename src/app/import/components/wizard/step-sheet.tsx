'use client'

import { useTranslations } from 'next-intl'

import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge, Table, TableBody, TableCell, TableRow } from '@/components/ui'
import type { ImportWizard } from '@/app/import/hooks/use-import-wizard'
import { anchor } from '@/constants'

/** Rows of the raw grid to show. Enough to find a header past any preamble. */
const GRID_ROWS = 12

/**
 * Sheet choice and header/data rows, as one step on the raw grid.
 *
 * Today these are three controls in two places — a Select above the mapper, and two number inputs
 * inside it — so you set a row number and check the result somewhere else. Clicking the row in the
 * data you are describing removes the indirection: the answer is visible where the question is.
 */
export function StepSheet({ wizard }: { wizard: ImportWizard }) {
  const t = useTranslations()
  const { sheet, sheets, headerRow, dataRow } = wizard
  if (!sheet) return null
  const grid = sheet.rows.slice(0, GRID_ROWS)

  return (
    <div className="space-y-6" {...anchor('importSheet')}>
      <div>
        <h3 className="font-medium">{t('import.sheet.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('import.sheet.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sheets.map((candidate) => (
          <button
            key={candidate.name}
            type="button"
            data-testid={`sheet-option-${candidate.name}`}
            onClick={() => wizard.selectSheet(candidate.name)}
            aria-pressed={candidate.name === sheet.name}
            className={cn(
              'rounded-md border px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              candidate.name === sheet.name
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <p className="text-sm font-medium">{candidate.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('import.sheet.dimensions', {
                rows: candidate.rows.length,
                columns: (candidate.rows[candidate.suggestedHeaderRow] ?? [])
                  .length,
              })}
            </p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {t('import.sheet.guessed', { row: sheet.suggestedHeaderRow + 1 })}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableBody>
              {grid.map((row, index) => {
                const isHeader = index === headerRow
                const isFirstData = index === dataRow
                const isPreamble = index < headerRow
                return (
                  <TableRow
                    key={index}
                    data-testid={`sheet-row-${index}`}
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
                          <Badge
                            variant="outline"
                            data-testid="sheet-header-badge"
                            className="font-normal"
                          >
                            {t('import.sheet.headerBadge')}
                          </Badge>
                        ) : isFirstData ? (
                          <Badge
                            variant="outline"
                            data-testid="sheet-data-badge"
                            className="font-normal"
                          >
                            {t('import.sheet.dataBadge')}
                          </Badge>
                        ) : (
                          <span className="flex gap-1">
                            <button
                              type="button"
                              data-testid={`sheet-mark-header-${index}`}
                              onClick={() => wizard.selectHeaderRow(index)}
                              className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              {t('import.sheet.markHeader')}
                            </button>
                            <button
                              type="button"
                              data-testid={`sheet-mark-data-${index}`}
                              onClick={() => wizard.selectDataRow(index)}
                              className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              {t('import.sheet.markData')}
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

        <p
          data-testid="sheet-row-summary"
          className="text-xs text-muted-foreground tabular-nums"
        >
          {headerRow > 0 &&
            `${t('import.sheet.ignoringAbove', { count: headerRow })} `}
          {t('import.sheet.reading', { count: wizard.dataRows.length })}
        </p>
      </div>
    </div>
  )
}
