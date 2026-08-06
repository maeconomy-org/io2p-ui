/**
 * Read an XLSX or CSV file into rows of TEXT.
 *
 * The old parser produced subtly different rows for the same sheet depending on how it was
 * saved, in three ways, and every one of them reached the import:
 *
 *   • a blank cell was `''` from CSV and `null` from XLSX;
 *   • a number was coerced by CSV (`'1974'` → `1974`) and left alone by XLSX;
 *   • a date cell became an ISO timestamp from XLSX and stayed `1974` in CSV.
 *
 * So "the same sheet saved two ways imports differently" — the kind of difference nobody sees
 * until the data is already written. Both readers here converge on ONE normalized shape: every
 * cell is a trimmed string, and a blank is `''`. Numbers are not coerced, because the node stores
 * a value's authored text and derives `num`/`unit` itself — coercing here would turn `007` into
 * `7` and `1.0` into `1` before it ever reached the normalizer.
 *
 * Both parsers are imported dynamically: exceljs and papaparse together are large, and nobody
 * pays for them until they pick a file.
 */

export interface ParsedSheet {
  name: string
  /** Every cell trimmed to a string; a blank cell is `''`. */
  rows: string[][]
  /**
   * The 1-based line each row occupies IN THE FILE, index-aligned with `rows`.
   *
   * Kept as a parallel array rather than folded into the row so `rows` stays a plain string[][] —
   * the preview, the header detector and the suggester all consume it as one.
   *
   * It cannot be derived downstream, which is the whole point: rows are trimmed at the ends here
   * and sliced again at the data row later, so by the time the builder reports "row 12" it has no
   * way back to what the operator sees in Excel. Everything before this carried an index and
   * called it a row.
   */
  rowNumbers: number[]
  /** Best guess at the header row, 0-based. The user can override it. */
  suggestedHeaderRow: number
}

export interface ParseOptions {
  maxBytes?: number
  onProgress?: (percent: number) => void
}

export class SheetParseError extends Error {}

/** 100 MB — the same ceiling the node advertises for one import. */
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024

// One cell → text. This is the single place the two parsers converge, so a difference between
// them has one place to be fixed rather than two to be kept in step.
function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    // ExcelJS rich text: `{ richText: [{ text }] }`. Also covers a hyperlink cell, whose `text`
    // is what the operator actually sees in the sheet.
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
 * Guess which row holds the headers.
 *
 * Real exports open with a title, a blank line and an "as of" line before the actual header, so
 * assuming row 0 is wrong more often than not. A header row looks like: several non-empty cells,
 * all text, followed by a row of similar width. Only a SUGGESTION — the picker lets the user
 * correct it, because no heuristic survives every sheet.
 */
export function detectHeaderRow(rows: readonly string[][]): number {
  const limit = Math.min(20, rows.length - 1)
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i]
    const next = rows[i + 1]
    if (!row || !next) continue

    const filled = row.filter((cell) => cell !== '').length
    if (filled < 2) continue
    // A header is text; the row under it is the data. If the next row is about as wide, this row
    // is a header rather than a stray title cell.
    const nextFilled = next.filter((cell) => cell !== '').length
    if (nextFilled >= Math.max(2, Math.floor(filled * 0.6))) return i
  }
  return 0
}

/**
 * Drop leading and trailing blank rows; keep interior ones (they may be meaningful gaps).
 *
 * Trims the row NUMBERS in step, which is why they have to arrive here rather than being counted
 * afterwards — the surviving rows no longer start at line 1.
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
    // NOT `'greedy'`. That drops every all-empty line INCLUDING interior ones, so a gap in the
    // middle of a CSV shifted every line number below it — while the XLSX path keeps interior
    // blanks (`includeEmpty: true`) and reported them correctly. The same sheet saved two ways
    // gave two different answers to "which row failed", in the one file whose entire job is
    // making the two readers converge. Blanks are trimmed at the ENDS below, for both.
    skipEmptyLines: false,
    // NO `transform`. The old one coerced numbers, which is both a divergence from the XLSX
    // path and lossy: `007` became `7`.
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
    // ExcelJS hands us the real spreadsheet row, which is the number in the operator's row
    // gutter. Taken rather than counted: `eachRow` can skip rows a workbook never materialised,
    // so a running counter would drift from what Excel shows.
    const numbers: number[] = []
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        // A formula cell carries both the formula and its last computed result; the result is
        // what the operator sees, and the only part that means anything here.
        const value =
          cell.type === 6 && cell.result !== undefined
            ? cell.result
            : cell.value
        cells[columnNumber - 1] = toText(value)
      })
      // `eachCell` skips trailing empties, so pad to a rectangle — otherwise a column index
      // means a different thing on different rows.
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

  if (sheets.length === 0) throw new SheetParseError('This file has no data')
  return sheets
}

export async function parseSheetFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedSheet[]> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  if (file.size > maxBytes) {
    throw new SheetParseError(
      `That file is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${Math.round(maxBytes / 1024 / 1024)} MB`
    )
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(file, options.onProgress)
  if (name.endsWith('.xlsx')) return parseXlsx(file, options.onProgress)
  throw new SheetParseError('Only .xlsx and .csv files can be imported')
}
