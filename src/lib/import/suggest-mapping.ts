/**
 * First-guess mapping from the headers and the data itself.
 *
 * The old wizard opened with every column set to "Don't Import", so a column literally named
 * `Name` still had to be mapped by hand — and on a 20-column municipal export that is 20
 * decisions before anything can happen. Everything here is a SUGGESTION the user can overrule;
 * nothing is applied silently, and the two consequential guesses (hierarchy, destination) are
 * offered rather than pre-applied, because turning 1,200 rows into 1,847 objects is too large a
 * change to arrive already made.
 */

import type { ColumnTarget } from './build-items'
import { deriveKey } from './build-items'

/** Header words that name a field rather than a property. Lower-case, accent-free comparison. */
const NAME_WORDS = ['name', 'bezeichnung', 'naam', 'titel', 'title', 'label']
const DESCRIPTION_WORDS = [
  'description',
  'beschreibung',
  'omschrijving',
  'notes',
]
const ADDRESS_WORDS = ['address', 'adresse', 'adres', 'anschrift']
const KEY_WORDS = ['id', 'key', 'code', 'nummer', 'number', 'ref']
const PARENT_WORDS = [
  'parent',
  'parent_id',
  'parentid',
  'übergeordnet',
  'boven',
]

const ADDRESS_PARTS: Record<string, ColumnTarget> = {
  street: { kind: 'addressPart', part: 'street' },
  strasse: { kind: 'addressPart', part: 'street' },
  straße: { kind: 'addressPart', part: 'street' },
  city: { kind: 'addressPart', part: 'city' },
  stadt: { kind: 'addressPart', part: 'city' },
  ort: { kind: 'addressPart', part: 'city' },
  postcode: { kind: 'addressPart', part: 'postalCode' },
  postalcode: { kind: 'addressPart', part: 'postalCode' },
  plz: { kind: 'addressPart', part: 'postalCode' },
  zip: { kind: 'addressPart', part: 'postalCode' },
  country: { kind: 'addressPart', part: 'country' },
  land: { kind: 'addressPart', part: 'country' },
  state: { kind: 'addressPart', part: 'state' },
}

const normalize = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const matches = (header: string, words: string[]) => {
  const n = normalize(header)
  return words.some((word) => n === normalize(word))
}

/** A cell that looks like a link — the signal for a file-reference column. */
const looksLikeUrl = (value: string) => /^https?:\/\//i.test(value.trim())

/**
 * Columns whose values REPEAT down the sheet — the signal that they describe a parent rather
 * than the row.
 *
 * Returned as a suggestion only. A column of 1,200 rows with 4 distinct values is almost
 * certainly a grouping level; one with 1,190 distinct values is certainly not.
 */
export function suggestLevels(
  rows: readonly string[][],
  columnCount: number
): number[] {
  if (rows.length < 4) return []
  const levels: { column: number; distinct: number }[] = []

  for (let column = 0; column < columnCount; column += 1) {
    const values = rows.map((row) => row[column] ?? '').filter(Boolean)
    if (values.length < rows.length * 0.9) continue // a sparse column is not a level
    const distinct = new Set(values).size
    // Repeats a lot, but is not a single constant (that is a document-wide attribute, not a
    // level) and is not near-unique (that is the row's own identity).
    if (distinct > 1 && distinct <= Math.max(2, values.length * 0.5)) {
      levels.push({ column, distinct })
    }
  }
  // Outermost first: a building has fewer distinct values than its floors, which have fewer than
  // their rooms. That ordering IS the nesting.
  return levels.sort((a, b) => a.distinct - b.distinct).map((l) => l.column)
}

export interface Suggestion {
  columns: Record<number, ColumnTarget>
  /** Offered, never applied — accepting it changes how many objects get created. */
  suggestedLevels: number[]
}

export function suggestMapping(
  headers: readonly string[],
  sampleRows: readonly string[][]
): Suggestion {
  const columns: Record<number, ColumnTarget> = {}
  let nameTaken = false

  headers.forEach((header, index) => {
    const samples = sampleRows
      .map((row) => row[index] ?? '')
      .filter(Boolean)
      .slice(0, 5)

    // A column of links is a file reference whatever its header says — the data is a stronger
    // signal than the wording.
    if (samples.length > 0 && samples.every((s) => looksLikeUrl(s))) {
      columns[index] = { kind: 'fileUrl' }
      return
    }

    const part = ADDRESS_PARTS[normalize(header)]
    if (part) {
      columns[index] = part
      return
    }
    if (matches(header, ADDRESS_WORDS)) {
      columns[index] = { kind: 'address' }
      return
    }
    if (!nameTaken && matches(header, NAME_WORDS)) {
      columns[index] = { kind: 'name' }
      nameTaken = true
      return
    }
    if (matches(header, DESCRIPTION_WORDS)) {
      columns[index] = { kind: 'description' }
      return
    }
    if (matches(header, PARENT_WORDS)) {
      columns[index] = { kind: 'parent' }
      return
    }
    if (matches(header, KEY_WORDS)) {
      columns[index] = { kind: 'key' }
      return
    }

    // Everything else becomes a PROPERTY rather than nothing. A column left unmapped is data the
    // operator brought and the import silently discarded; a property they did not want is one
    // click to remove and visible while they decide.
    columns[index] = {
      kind: 'property',
      key: deriveKey(header),
      label: header.trim() || `Column ${index + 1}`,
      split: suggestSplit(samples),
    }
  })

  return {
    columns,
    suggestedLevels: suggestLevels(sampleRows, headers.length),
  }
}

/**
 * A delimiter, if the cells consistently carry one.
 *
 * The node's model holds many values per property, which the old mapper could not reach at all —
 * `NH-101-A | NH-101-B` went in as one string. Requires the delimiter in MOST non-empty samples,
 * so an address that happens to contain a comma is not mistaken for a list.
 */
export function suggestSplit(samples: readonly string[]): string | null {
  if (samples.length < 2) return null
  for (const delimiter of ['|', ';']) {
    const hits = samples.filter((s) => s.includes(delimiter)).length
    if (hits >= Math.ceil(samples.length * 0.6)) return delimiter
  }
  return null
}
