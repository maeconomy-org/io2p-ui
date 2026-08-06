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
import type { ImportMessage } from '@/lib/import/messages'
import { logger } from '@/lib/observability/logger'
import { DEFAULT_CLIENT_CONFIG, getCachedConfig } from '@/constants/client'

/** How many rows the preview renders. The full sheet is still what gets built. */
const PREVIEW_ROWS = 50
/** Rows the suggester looks at. Enough to judge repetition without walking 50,000 rows. */
const SAMPLE_ROWS = 200

/**
 * The caps this deployment advertises, from runtime config.
 *
 * Read here rather than imported as constants: both were hardcoded (a 100 MB literal in the parser,
 * and an unused `MAX_OBJECTS_PER_IMPORT`), so `MAX_IMPORT_FILE_SIZE_MB` and `MAX_OBJECTS_PER_IMPORT`
 * could be set on a deployment and change nothing — the env var went into `__IOM_CONFIG__` and no
 * code ever read it back. A limit nobody enforces is worse than no limit: it is a promise the UI
 * makes and the node breaks.
 */
function importLimits() {
  const config = getCachedConfig() ?? DEFAULT_CLIENT_CONFIG
  return {
    maxBytes: config.maxImportFileSizeMB * 1024 * 1024,
    maxObjects: config.maxObjectsPerImport,
  }
}

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
  const [error, setError] = useState<ImportMessage | null>(null)

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
          maxBytes: importLimits().maxBytes,
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
        // A SheetParseError is OUR refusal — too big, wrong extension, no data — and its message
        // is already on screen. Anything else came out of exceljs or papaparse and is the only
        // evidence of why a real file failed; without this it became "That file could not be
        // read" and vanished. Name and size, never the contents.
        if (!(cause instanceof SheetParseError)) {
          logger.error('import_parse_failed', {
            err: cause,
            fileName: picked.name,
            fileSize: picked.size,
          })
        }
        setError(
          cause instanceof SheetParseError
            ? { key: cause.key, values: cause.values }
            : { key: 'import.error.unreadable' }
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

  /**
   * Move where the data starts, never above the header.
   *
   * The picker offers a "data" button on every row, including rows ABOVE the header, and the raw
   * setter accepted them: `dataRows` is `rows.slice(dataRow)`, so choosing an earlier row swept the
   * preamble AND THE HEADER ROW ITSELF into the data — the header line was imported as an object
   * named `Building`. Clamped here rather than at the one call site, so a second caller cannot
   * reintroduce it.
   */
  const selectDataRow = useCallback(
    (index: number) => setDataRow(Math.max(index, headerRow + 1)),
    [headerRow]
  )

  const headers = useMemo(
    () => (sheet?.rows[headerRow] ?? []).map((h) => h.trim()),
    [sheet, headerRow]
  )

  const dataRows = useMemo(
    () => sheet?.rows.slice(dataRow) ?? [],
    [sheet, dataRow]
  )

  // Sliced with the SAME bound as `dataRows`, because the two are index-aligned and the builder
  // reads a row's number by its position. Slicing one without the other reports every failure
  // against the wrong line, and nothing would surface the drift.
  const dataRowNumbers = useMemo(
    () => sheet?.rowNumbers.slice(dataRow) ?? [],
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
    () => buildItems(dataRows, mapping, headers, dataRowNumbers),
    [dataRows, mapping, headers, dataRowNumbers]
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
  const blockedBecause = useMemo((): ImportMessage | null => {
    if (!sheet) return { key: 'import.blocked.noFile' }
    const named =
      levels.length > 0 ||
      Object.values(columns ?? {}).some((t) => t.kind === 'name')
    if (!named) return { key: 'import.blocked.noName' }
    if (built.items.length === 0)
      return { key: 'import.blocked.createsNothing' }
    // Counted on OBJECTS, not rows: with a hierarchy on, 1,200 rows become 1,847 objects, and the
    // node's cap is on what gets created. Refused here rather than after staging every item.
    const { maxObjects } = importLimits()
    if (built.items.length > maxObjects) {
      return {
        key: 'import.blocked.tooManyObjects',
        // Numbers stay NUMBERS: next-intl formats them for the active locale, so a Dutch user
        // sees 1.847 rather than the 1,847 a `toLocaleString('en-US')` here would have forced.
        values: { count: built.items.length, limit: maxObjects },
      }
    }
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
    selectDataRow,
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
