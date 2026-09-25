'use client'

/**
 * The wizard's state: file → sheet → header row → mapping → items.
 *
 * ONE hook, not state per step: every value downstream depends on one upstream, so held together
 * the cascade is a `useMemo` chain and held apart it is effects firing in an unpredictable order.
 *
 * Nothing here talks to the network — it produces `ImportItemInput[]`; `useRunImport` sends them.
 */

import { useCallback, useMemo, useState } from 'react'

import {
  ATTACH_EVERY_LEVEL,
  type BuildMapping,
  buildItems,
  type ColumnTarget,
} from '@/app/import/lib/build-items'
import {
  type ParsedSheet,
  parseSheetFile,
  SheetParseError,
} from '@/app/import/lib/parse-sheet'
import { suggestMapping } from '@/app/import/lib/suggest-mapping'
import type { ImportMessage } from '@/app/import/lib/messages'
import { logger } from '@/lib/observability/logger'
import { DEFAULT_CLIENT_CONFIG, getCachedConfig } from '@/constants/client'

/** How many rows the preview renders. The full sheet is still what gets built. */
const PREVIEW_ROWS = 50
/** Rows the suggester looks at. Enough to judge repetition without walking 50,000 rows. */
const SAMPLE_ROWS = 200

/**
 * The caps this deployment advertises, from runtime config — never constants. A limit nobody reads
 * back is worse than no limit: a promise the UI makes and the node breaks.
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
        // A SheetParseError is OUR refusal and already on screen. Anything else came from exceljs
        // or papaparse and is the only evidence of why a real file failed. Name and size, never
        // the contents.
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
   * Move where the data starts, never above the header. `dataRows` is `rows.slice(dataRow)`, so an
   * earlier row sweeps the preamble AND THE HEADER into the data and imports an object named
   * `Building`. Clamped here, not at the call site, so a second caller cannot reintroduce it.
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

  // SAME bound as `dataRows`: the two are index-aligned and the builder reads a row's number by
  // position, so slicing one without the other reports every failure against the wrong line.
  const dataRowNumbers = useMemo(
    () => sheet?.rowNumbers.slice(dataRow) ?? [],
    [sheet, dataRow]
  )

  const wizardColumns = useMemo<WizardColumn[]>(
    () =>
      headers.map((header, index) => ({
        index,
        // Raw and possibly empty: a blank header reads one way on screen (translated) and another
        // in the data (`columnLabel`), and a fallback here can only serve one.
        header,
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
   * The built envelope, from the WHOLE sheet rather than the preview. This is the number the
   * wizard shows, and with a hierarchy on the object count is not the row count.
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

  /**
   * The ONE way the hierarchy changes — the toggle and the suggestion prompt both come through
   * here, because accepting a hierarchy carries a decision about the address columns with it and a
   * second entry point would silently skip it.
   */
  const applyLevels = useCallback(
    (next: number[]) => {
      setLevels(next)

      // The row asserts its address for the whole path it names, so it belongs on every object on
      // that path — the default owner is the DEEPEST level alone, which gives the rooms an address
      // and the building none. Seeded only for a column the user has not placed, so the
      // per-column selector still wins.
      if (next.length === 0) return
      setAttachTo((chosen) => {
        const seeded = { ...chosen }
        for (const [key, target] of Object.entries(columns ?? {})) {
          const column = Number(key)
          const isAddress =
            target.kind === 'address' || target.kind === 'addressPart'
          if (!isAddress || next.includes(column) || column in seeded) continue
          seeded[column] = ATTACH_EVERY_LEVEL
        }
        return seeded
      })
    },
    [columns]
  )

  /** Toggle a column in or out of the hierarchy. Order is the nesting, so it is preserved. */
  const toggleLevel = useCallback(
    (index: number) =>
      applyLevels(
        levels.includes(index)
          ? levels.filter((c) => c !== index)
          : [...levels, index]
      ),
    [levels, applyLevels]
  )

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

  /** Why the wizard cannot continue, or `null` — a REASON, so it can sit beside the dead button. */
  const blockedBecause = useMemo((): ImportMessage | null => {
    if (!sheet) return { key: 'import.blocked.noFile' }
    const named =
      levels.length > 0 ||
      Object.values(columns ?? {}).some((t) => t.kind === 'name')
    if (!named) return { key: 'import.blocked.noName' }
    if (built.items.length === 0)
      return { key: 'import.blocked.createsNothing' }
    // Counted on OBJECTS, not rows: the node's cap is on what gets created, and with a hierarchy
    // on 1,200 rows become 1,847 objects.
    const { maxObjects } = importLimits()
    if (built.items.length > maxObjects) {
      return {
        key: 'import.blocked.tooManyObjects',
        // Numbers stay NUMBERS so next-intl formats them for the active locale.
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
    /** Index-aligned with `dataRows` — the real file line of each. */
    dataRowNumbers,
    previewRows: useMemo(() => dataRows.slice(0, PREVIEW_ROWS), [dataRows]),
    columns: wizardColumns,
    // mapping
    mapping,
    setColumn,
    levels,
    suggestedLevels,
    toggleLevel,
    setLevels: applyLevels,
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
