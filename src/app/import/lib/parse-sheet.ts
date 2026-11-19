/**
 * Read an XLSX or CSV file into rows of TEXT.
 *
 * THE TWO READERS MUST CONVERGE: every cell is a trimmed string and a blank is `''`, or the same
 * sheet saved two ways imports differently — a difference nobody sees until the data is written.
 * Numbers are never coerced: the node stores a value's authored text and derives `num`/`unit`
 * itself, so coercing here turns `007` into `7` before the normalizer ever sees it.
 *
 * Both parsers load dynamically — exceljs and papaparse are large, and nobody pays until they
 * pick a file.
 */

import type { ImportMessage, ImportMessageKey } from './messages'

export interface ParsedSheet {
  name: string
  /** Every cell trimmed to a string; a blank cell is `''`. */
  rows: string[][]
  /**
   * The 1-based line each row occupies IN THE FILE, index-aligned with `rows`. It cannot be
   * derived downstream — rows are trimmed at the ends here and sliced again at the data row
   * later, so by then "row 12" has no way back to what the operator sees in Excel.
   */
  rowNumbers: number[]
  /** Best guess at the header row, 0-based. The user can override it. */
  suggestedHeaderRow: number
}

export interface ParseOptions {
  maxBytes?: number
  onProgress?: (percent: number) => void
}

/**
 * A refusal the USER is meant to read. `Error.message` keeps the key so a stack trace still says
 * which refusal it was; the component renders `t(key, values)`.
 */
export class SheetParseError extends Error {
  constructor(
    readonly key: ImportMessageKey,
    readonly values?: ImportMessage['values']
  ) {
    super(key)
    this.name = 'SheetParseError'
  }
}

/** Fallback ceiling. The app always passes `maxBytes` from runtime config; this is for tests. */
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024

// The single place the two parsers converge.
function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // ExcelJS rich text and hyperlink cells both carry what the operator sees under `text`.
    const rich = value as { richText?: { text: string }[]; text?: string }
    if (Array.isArray(rich.richText)) {
      return rich.richText
        .map((part) => part.text)
        .join('')
        .trim()
    }
    if (typeof rich.text === 'string') return rich.text.trim()
    return ''
  }
  return String(value).trim()
}

const isBlankRow = (row: string[]) => row.every((cell) => cell === '')

/**
 * Guess which row holds the headers: several non-empty text cells followed by a row of similar
 * width. Real exports open with a title and an "as of" line, so row 0 is wrong more often than
 * not. A SUGGESTION only — the picker lets the user correct it.
 */
export function detectHeaderRow(rows: readonly string[][]): number {
  const limit = Math.min(20, rows.length - 1)
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i]
    const next = rows[i + 1]
    if (!row || !next) continue

    const filled = row.filter((cell) => cell !== '').length
    if (filled < 2) continue
    // If the next row is about as wide, this is a header rather than a stray title cell.
    const nextFilled = next.filter((cell) => cell !== '').length
    if (nextFilled >= Math.max(2, Math.floor(filled * 0.6))) return i
  }
  return 0
}

/**
 * Drop leading and trailing blank rows; keep interior ones. Trims the row NUMBERS in step — the
 * surviving rows no longer start at line 1.
 */
function trimBlankRows(
  rows: string[][],
  numbers: number[]
): { rows: string[][]; rowNumbers: number[] } {
  let start = 0
  let end = rows.length
  while (start < end && isBlankRow(rows[start]!)) start += 1
  while (end > start && isBlankRow(rows[end - 1]!)) end -= 1
  return {
    rows: rows.slice(start, end),
    rowNumbers: numbers.slice(start, end),
  }
}

async function parseCsv(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ParsedSheet[]> {
  onProgress?.(10)
  const text = await file.text()
  onProgress?.(40)

  const Papa = (await import('papaparse')).default
  const result = Papa.parse<string[]>(text, {
    header: false,
    // NOT `'greedy'`: that drops interior blank lines too, shifting every line number below a
    // gap, while the XLSX path keeps them. Blanks are trimmed at the ENDS below, for both.
    skipEmptyLines: false,
    // NO `transform`: coercing numbers diverges from the XLSX path and is lossy — `007` → `7`.
  })
  onProgress?.(80)

  const parsed = (result.data as unknown[][]).map((row) =>
    row.map((cell) => toText(cell))
  )
  // Papa returns lines in file order with nothing skipped, so the index IS the line.
  const { rows, rowNumbers } = trimBlankRows(
    parsed,
    parsed.map((_, index) => index + 1)
  )
  onProgress?.(100)
  return [
    {
      name: 'Sheet1',
      rows,
      rowNumbers,
      suggestedHeaderRow: detectHeaderRow(rows),
    },
  ]
}

async function parseXlsx(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ParsedSheet[]> {
  onProgress?.(10)
  const buffer = await file.arrayBuffer()
  onProgress?.(40)

  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  onProgress?.(70)

  const sheets: ParsedSheet[] = []
  workbook.eachSheet((worksheet) => {
    const raw: string[][] = []
    // Taken, not counted: `eachRow` skips rows a workbook never materialised, so a running
    // counter drifts from the number in the operator's row gutter.
    const numbers: number[] = []
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        // A formula cell carries both the formula and its last result; the result is what the
        // operator sees.
        const value =
          cell.type === 6 && cell.result !== undefined
            ? cell.result
            : cell.value
        cells[columnNumber - 1] = toText(value)
      })
      // `eachCell` skips trailing empties: pad to a rectangle, or a column index means different
      // things on different rows.
      for (let i = 0; i < cells.length; i += 1) cells[i] ??= ''
      raw.push(cells)
      numbers.push(row.number)
    })
    const { rows, rowNumbers } = trimBlankRows(raw, numbers)
    if (rows.length > 0) {
      sheets.push({
        name: worksheet.name,
        rows,
        rowNumbers,
        suggestedHeaderRow: detectHeaderRow(rows),
      })
    }
  })
  onProgress?.(100)

  if (sheets.length === 0) throw new SheetParseError('import.error.noData')
  return sheets
}

export async function parseSheetFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedSheet[]> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  if (file.size > maxBytes) {
    throw new SheetParseError('import.error.fileTooBig', {
      size: Math.round(file.size / 1024 / 1024),
      limit: Math.round(maxBytes / 1024 / 1024),
    })
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(file, options.onProgress)
  if (name.endsWith('.xlsx')) return parseXlsx(file, options.onProgress)
  throw new SheetParseError('import.error.unsupportedType')
}
