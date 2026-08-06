'use client'

/**
 * The wizard's state: file → sheet → header row → mapping → items.
 *
 * One hook rather than state spread across five steps, because every value downstream depends on
 * one upstream: changing the header row re-reads the columns, which re-suggests the mapping,
 * which changes what gets built. Held in a single place, that cascade is a `useMemo` chain; held
 * per step it is a set of effects that fire in an order nobody can predict.
 *
 * Nothing here talks to the network. The hook produces `ImportItemInput[]`; `useRunImport` sends
 * them.
 */

import { useCallback, useMemo, useState } from 'react'

import {
  type BuildMapping,
  buildItems,
  type ColumnTarget,
} from '@/lib/import/build-items'
import {
  type ParsedSheet,
  parseSheetFile,
  SheetParseError,
} from '@/lib/import/parse-sheet'
import { suggestMapping } from '@/lib/import/suggest-mapping'

/** How many rows the preview renders. The full sheet is still what gets built. */
const PREVIEW_ROWS = 50
/** Rows the suggester looks at. Enough to judge repetition without walking 50,000 rows. */
const SAMPLE_ROWS = 200

export interface WizardColumn {
  index: number
  header: string
  /** First few non-empty values — what makes a mapping decision possible without guessing. */
  samples: string[]
}

export function useImportWizard() {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [sheetName, setSheetName] = useState('')
  const [headerRow, setHeaderRow] = useState(0)
  const [dataRow, setDataRow] = useState(1)
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // `null` until a sheet is read — that is what tells the map step to seed itself from the
  // suggester rather than from an empty object the user would have to fill by hand.
  const [columns, setColumns] = useState<Record<number, ColumnTarget> | null>(
    null
  )
  const [levels, setLevels] = useState<number[]>([])
  const [suggestedLevels, setSuggestedLevels] = useState<number[]>([])
  const [attachTo, setAttachTo] = useState<Record<number, number>>({})
  const [destination, setDestination] = useState<string | null>(null)

  const sheet = useMemo(
    () => sheets.find((s) => s.name === sheetName) ?? sheets[0] ?? null,
    [sheets, sheetName]
  )

  /** Seed the mapping from a sheet + header row. Re-run whenever either changes. */
  const seedMapping = useCallback((from: ParsedSheet, header: number) => {
    const headers = (from.rows[header] ?? []).map((h) => h.trim())
    const sample = from.rows.slice(header + 1, header + 1 + SAMPLE_ROWS)
    const suggestion = suggestMapping(headers, sample)
    setColumns(suggestion.columns)
    setSuggestedLevels(suggestion.suggestedLevels)
    // Levels are OFFERED, not applied: accepting them changes how many objects get created.
    setLevels([])
    setAttachTo({})
  }, [])

  const pickFile = useCallback(
    async (picked: File) => {
      setParsing(true)
      setError(null)
      setProgress(0)
      try {
        const parsed = await parseSheetFile(picked, {
          onProgress: setProgress,
        })
        const first = parsed[0]!
        setFile(picked)
        setSheets(parsed)
        setSheetName(first.name)
        setHeaderRow(first.suggestedHeaderRow)
        setDataRow(first.suggestedHeaderRow + 1)
        seedMapping(first, first.suggestedHeaderRow)
        return true
      } catch (cause) {
        setError(
          cause instanceof SheetParseError
            ? cause.message
            : 'That file could not be read'
        )
        return false
      } finally {
        setParsing(false)
      }
    },
    [seedMapping]
  )

  /** Switching sheets re-reads everything: a different sheet has different columns. */
  const selectSheet = useCallback(
    (name: string) => {
      const next = sheets.find((s) => s.name === name)
      if (!next) return
      setSheetName(name)
      setHeaderRow(next.suggestedHeaderRow)
      setDataRow(next.suggestedHeaderRow + 1)
      seedMapping(next, next.suggestedHeaderRow)
    },
    [sheets, seedMapping]
  )

  const selectHeaderRow = useCallback(
    (index: number) => {
      setHeaderRow(index)
      // Data almost always starts on the next row; the user can still move it.
      setDataRow((current) => (current <= index ? index + 1 : current))
      if (sheet) seedMapping(sheet, index)
    },
    [sheet, seedMapping]
  )

  const headers = useMemo(
    () => (sheet?.rows[headerRow] ?? []).map((h) => h.trim()),
    [sheet, headerRow]
  )

  const dataRows = useMemo(
    () => sheet?.rows.slice(dataRow) ?? [],
    [sheet, dataRow]
  )

  const wizardColumns = useMemo<WizardColumn[]>(
    () =>
      headers.map((header, index) => ({
        index,
        header: header || `Column ${index + 1}`,
        samples: dataRows
          .slice(0, 20)
          .map((row) => row[index] ?? '')
          .filter(Boolean)
          .slice(0, 3),
      })),
    [headers, dataRows]
  )

  const mapping = useMemo<BuildMapping>(
    () => ({ columns: columns ?? {}, levels, attachTo, destination }),
    [columns, levels, attachTo, destination]
  )

  /**
   * The built envelope — recomputed from the WHOLE sheet, not the preview.
   *
   * This is the number the wizard shows ("import 1,847 objects"), so it has to be derived rather
   * than estimated: with hierarchy on, the object count is not the row count, and a hardcoded
   * figure keeps claiming the old total after a level is removed.
   */
  const built = useMemo(
    () => buildItems(dataRows, mapping, headers),
    [dataRows, mapping, headers]
  )

  const setColumn = useCallback(
    (index: number, target: ColumnTarget | null) => {
      setColumns((current) => {
        const next = { ...(current ?? {}) }
        if (target === null) delete next[index]
        else next[index] = target
        return next
      })
    },
    []
  )

  /** Toggle a column in or out of the hierarchy. Order is the nesting, so it is preserved. */
  const toggleLevel = useCallback((index: number) => {
    setLevels((current) =>
      current.includes(index)
        ? current.filter((c) => c !== index)
        : [...current, index]
    )
  }, [])

  const reset = useCallback(() => {
    setFile(null)
    setSheets([])
    setSheetName('')
    setColumns(null)
    setLevels([])
    setSuggestedLevels([])
    setAttachTo({})
    setDestination(null)
    setError(null)
    setProgress(0)
  }, [])

  /**
   * Why the wizard cannot continue yet, or `null`.
   *
   * A REASON rather than a boolean, so it can be shown next to the disabled button instead of
   * left to be guessed at.
   */
  const blockedBecause = useMemo(() => {
    if (!sheet) return 'Choose a file first'
    const named =
      levels.length > 0 ||
      Object.values(columns ?? {}).some((t) => t.kind === 'name')
    if (!named) return 'Map a column to Name, or pick a hierarchy first'
    if (built.items.length === 0) return 'This mapping would create nothing'
    return null
  }, [sheet, levels, columns, built.items.length])

  return {
    // input
    file,
    sheets,
    sheet,
    parsing,
    progress,
    error,
    pickFile,
    selectSheet,
    reset,
    // shape
    headerRow,
    dataRow,
    selectHeaderRow,
    setDataRow,
    headers,
    dataRows,
    previewRows: useMemo(() => dataRows.slice(0, PREVIEW_ROWS), [dataRows]),
    columns: wizardColumns,
    // mapping
    mapping,
    setColumn,
    levels,
    suggestedLevels,
    toggleLevel,
    setLevels,
    attachTo,
    setAttachTo,
    destination,
    setDestination,
    // output
    items: built.items,
    problems: built.problems,
    blockedBecause,
  }
}

export type ImportWizard = ReturnType<typeof useImportWizard>
