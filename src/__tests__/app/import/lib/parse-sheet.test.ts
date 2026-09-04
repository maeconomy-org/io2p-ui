/**
 * The reader, which had no tests at all — and was the module with the divergence.
 *
 * Its whole stated purpose is that the SAME sheet saved two ways imports identically, and the two
 * paths disagreed on interior blank rows: CSV parsed with `skipEmptyLines: 'greedy'` dropped them,
 * XLSX with `includeEmpty: true` kept them. Every failure below a gap in a CSV was then reported
 * against the wrong line, in the report whose only job is saying which line to open.
 *
 * So the convergence cases are the point of this file, not a nicety. Real files are built with
 * exceljs rather than mocked: a mock of a parser cannot disagree with the other parser, which is
 * exactly the property under test.
 */

import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'

import {
  detectHeaderRow,
  parseSheetFile,
  SheetParseError,
} from '@/app/import/lib/parse-sheet'

function csv(text: string): File {
  return new File([text], 'export.csv', { type: 'text/csv' })
}

async function xlsx(rows: unknown[][]): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  rows.forEach((row) => sheet.addRow(row))
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], 'export.xlsx')
}

describe('detectHeaderRow', () => {
  it('skips a title and an "as of" line to find the real header', () => {
    // What a municipal export actually opens with. Assuming row 0 is wrong more often than right.
    expect(
      detectHeaderRow([
        ['Objectenregister export'],
        ['Peildatum 2026-01-31'],
        ['Gebouw', 'Verdieping', 'Oppervlakte'],
        ['Noordpoort', 'BG', '24'],
      ])
    ).toBe(2)
  })

  it('needs a row of similar width below it, not just several cells', () => {
    // A wide banner with a sparse line under it is a title, not a header.
    expect(
      detectHeaderRow([
        ['Report', 'generated', 'by', 'system'],
        ['', '', '', ''],
        ['Name', 'Area'],
        ['Room 1', '24'],
      ])
    ).toBe(2)
  })

  it('falls back to row 0 rather than guessing wildly', () => {
    expect(detectHeaderRow([['Name', 'Area']])).toBe(0)
  })
})

describe('parseSheetFile — refusals', () => {
  it('refuses a file over the cap, with the sizes in the message', async () => {
    const big = new File(['x'.repeat(2048)], 'export.csv')
    await expect(
      parseSheetFile(big, { maxBytes: 1024 })
    ).rejects.toBeInstanceOf(SheetParseError)
  })

  it('refuses an extension it cannot read', async () => {
    await expect(
      parseSheetFile(new File(['x'], 'notes.txt'))
    ).rejects.toBeInstanceOf(SheetParseError)
  })
})

describe('parseSheetFile — cells become text, losslessly', () => {
  it('does NOT coerce numbers', async () => {
    // `007` is a building code, not seven, and `1.0` is an authored value. The node stores the
    // authored text and derives num/unit itself, so coercing here destroys data before the
    // normalizer ever sees it — the exact break the old reader shipped.
    const [sheet] = await parseSheetFile(csv('Code,Area\n007,1.0\n'))
    expect(sheet!.rows[1]).toEqual(['007', '1.0'])
  })

  it('renders a blank cell as an empty string, from either reader', async () => {
    const [fromCsv] = await parseSheetFile(csv('A,B\n,2\n'))
    const [fromXlsx] = await parseSheetFile(
      await xlsx([
        ['A', 'B'],
        [null, 2],
      ])
    )
    expect(fromCsv!.rows[1]).toEqual(['', '2'])
    expect(fromXlsx!.rows[1]).toEqual(['', '2'])
  })
})

describe('parseSheetFile — blank rows and the line numbers that depend on them', () => {
  const WITH_GAP = 'Name,Area\nRoom 1,24\n\nRoom 2,31\n'

  it('KEEPS an interior blank row', async () => {
    const [sheet] = await parseSheetFile(csv(WITH_GAP))
    expect(sheet!.rows).toEqual([
      ['Name', 'Area'],
      ['Room 1', '24'],
      [''],
      ['Room 2', '31'],
    ])
  })

  it('numbers rows by their FILE line, so a gap does not shift what follows', async () => {
    const [sheet] = await parseSheetFile(csv(WITH_GAP))
    // "Room 2" is on line 4. Dropping the blank made it line 3, and every failure below a gap
    // pointed at the wrong row.
    expect(sheet!.rowNumbers).toEqual([1, 2, 3, 4])
  })

  it('trims blank rows at the ENDS, and shifts the numbers with them', async () => {
    const [sheet] = await parseSheetFile(csv('\n\nName,Area\nRoom 1,24\n'))
    expect(sheet!.rows[0]).toEqual(['Name', 'Area'])
    // The first surviving row is file line 3 — numbers are trimmed alongside, not recounted.
    expect(sheet!.rowNumbers[0]).toBe(3)
  })

  it('gives CSV and XLSX the same rows AND the same line numbers', async () => {
    // The convergence claim, stated as a test. Same logical sheet, two encodings.
    const rows = [['Name', 'Area'], ['Room 1', '24'], [], ['Room 2', '31']]
    const [fromCsv] = await parseSheetFile(csv(WITH_GAP))
    const [fromXlsx] = await parseSheetFile(await xlsx(rows))

    expect(fromXlsx!.rowNumbers).toEqual(fromCsv!.rowNumbers)
    expect(fromXlsx!.rows.map((r) => r.filter(Boolean))).toEqual(
      fromCsv!.rows.map((r) => r.filter(Boolean))
    )
  })
})
