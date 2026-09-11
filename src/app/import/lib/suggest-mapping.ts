/**
 * First-guess mapping from the headers and the data itself. Everything here is a SUGGESTION the
 * user can overrule, and the two consequential guesses — hierarchy and destination — are OFFERED
 * rather than applied: turning 1,200 rows into 1,847 objects is too large a change to arrive
 * already made.
 */

import type { ColumnTarget } from './build-items'
import { columnLabel, deriveKey } from './build-items'

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
  // `gemeente` is deliberately NOT city: a municipality is a different administrative level, and
  // guessing it into `city` puts the wrong value in a field that looks right.
  straat: { kind: 'addressPart', part: 'street' },
  straatnaam: { kind: 'addressPart', part: 'street' },
  city: { kind: 'addressPart', part: 'city' },
  stadt: { kind: 'addressPart', part: 'city' },
  ort: { kind: 'addressPart', part: 'city' },
  plaats: { kind: 'addressPart', part: 'city' },
  woonplaats: { kind: 'addressPart', part: 'city' },
  postcode: { kind: 'addressPart', part: 'postalCode' },
  postalcode: { kind: 'addressPart', part: 'postalCode' },
  plz: { kind: 'addressPart', part: 'postalCode' },
  zip: { kind: 'addressPart', part: 'postalCode' },
  country: { kind: 'addressPart', part: 'country' },
  land: { kind: 'addressPart', part: 'country' },
  state: { kind: 'addressPart', part: 'state' },
  province: { kind: 'addressPart', part: 'state' },
  provincie: { kind: 'addressPart', part: 'state' },
  bundesland: { kind: 'addressPart', part: 'state' },
  // `nr` and `no` are bare enough to be risky elsewhere; here the header sits beside a street
  // column and the target is an address. Normalisation strips separators, so `house-number` and
  // `Huis nr.` both land here.
  housenumber: { kind: 'addressPart', part: 'houseNumber' },
  huisnummer: { kind: 'addressPart', part: 'houseNumber' },
  hausnummer: { kind: 'addressPart', part: 'houseNumber' },
  hausnr: { kind: 'addressPart', part: 'houseNumber' },
  huisnr: { kind: 'addressPart', part: 'houseNumber' },
  nr: { kind: 'addressPart', part: 'houseNumber' },
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
 * A measurement, so never a hierarchy level — a quantity is not a thing other things sit inside.
 * To a distinct-count test a column of metres looks exactly like a category: `WATERRANDLENGTE` had
 * 7 distinct values across 60 rows and was proposed as a level between a management group and a
 * planting decade.
 *
 * NOT applied to the mapping — a number is a fine property value. Only the level suggester needs
 * it, because only it infers meaning from shape. A comma decimal counts: these sheets are European.
 */
const looksNumeric = (value: string) => /^-?\d+([.,]\d+)?$/.test(value.trim())

function isMeasurement(values: readonly string[]): boolean {
  if (values.length === 0) return false
  const numeric = values.filter(looksNumeric).length
  return numeric >= values.length * 0.9
}

/**
 * U+0000 as an ESCAPE, never the literal byte — the byte lands inside git's binary-detection
 * window and the file stops being diffable. The separator must stay U+0000: it joins cell values
 * to count distinct combinations, so anything that can appear IN a cell undercounts.
 */
const COMBO_SEP = '\u0000'

/** Distinct combinations of the given columns across the rows. */
function distinctCombos(
  rows: readonly string[][],
  columns: readonly number[]
): number {
  const seen = new Set<string>()
  for (const row of rows) {
    seen.add(columns.map((column) => row[column] ?? '').join(COMBO_SEP))
  }
  return seen.size
}

/**
 * Columns that describe a HIERARCHY — an ancestor of the row rather than the row itself. Getting
 * this wrong is expensive: it decides how many objects are created.
 *
 * Repetition alone is not enough. `Adresse` repeats exactly as much as `Gebäude` does, so a
 * repetition test proposes `Gebäude › Geschoss › Adresse` and makes an address into a floor. The
 * real test is whether a column SUBDIVIDES what is there: `Geschoss` takes 2 groups to 3 and is a
 * level; `Adresse` leaves it at 2 and is an attribute of the building, via `attachTo`.
 *
 * OFFERED, never applied.
 */
export function suggestLevels(
  rows: readonly string[][],
  columnCount: number
): number[] {
  if (rows.length < 4) return []
  const candidates: { column: number; distinct: number }[] = []

  for (let column = 0; column < columnCount; column += 1) {
    const values = rows.map((row) => row[column] ?? '').filter(Boolean)
    if (values.length < rows.length * 0.9) continue // a sparse column is not a level
    if (isMeasurement(values)) continue // a quantity is never an ancestor
    const distinct = new Set(values).size
    // Not a single constant (that describes the document) and not near-unique (that is the row).
    if (distinct > 1 && distinct <= Math.max(2, values.length * 0.5)) {
      candidates.push({ column, distinct })
    }
  }

  // Fewest distinct values first: a building has fewer than its floors. That ordering IS the
  // nesting.
  candidates.sort((a, b) => a.distinct - b.distinct)

  const levels: number[] = []
  for (const candidate of candidates) {
    const before = levels.length === 0 ? 1 : distinctCombos(rows, levels)
    const after = distinctCombos(rows, [...levels, candidate.column])
    // Keep it only if it splits the groups further; an attribute leaves the count unchanged.
    if (after > before) levels.push(candidate.column)
  }
  return levels
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

    // A column of links is a file reference whatever its header says.
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

    // Everything else becomes a PROPERTY rather than nothing: an unmapped column is data the
    // operator brought and the import silently discarded.
    const label = columnLabel(header, index)
    columns[index] = {
      kind: 'property',
      key: deriveKey(header, index),
      label,
      split: suggestSplit(samples),
    }
  })

  return {
    columns,
    suggestedLevels: suggestLevels(sampleRows, headers.length),
  }
}

/**
 * A delimiter, if the cells consistently carry one — the node's model holds many values per
 * property. Required in MOST non-empty samples, so an address containing a comma is not a list.
 */
export function suggestSplit(samples: readonly string[]): string | null {
  if (samples.length < 2) return null
  for (const delimiter of ['|', ';']) {
    const hits = samples.filter((s) => s.includes(delimiter)).length
    if (hits >= Math.ceil(samples.length * 0.6)) return delimiter
  }
  return null
}
