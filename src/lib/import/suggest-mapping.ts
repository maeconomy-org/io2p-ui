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
  // Dutch was claimed by this module's docstring and half-missing in it: `straat` and `plaats` are
  // the two commonest columns in a Dutch register and neither was here, so both fell through to
  // ordinary properties and the address came out empty. `postcode` only worked by spelling the
  // same in both languages. `woonplaats` is the town on Dutch address records.
  //
  // `gemeente` is deliberately NOT city — a municipality is a different administrative level, and
  // guessing it into `city` would put the wrong value in a field that looks right.
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
  // `houseNumber` was mappable by hand but never suggested, so the one address column that is
  // ALWAYS separate in Dutch and German exports was the one the operator had to notice alone.
  // `nr` and `no` are bare enough to be risky in another domain; here the header sits beside a
  // street column and the target is an address, which is as much context as the rest of the table
  // gets. Normalisation strips separators, so `house-number` and `Huis nr.` both land here.
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
 * A measurement, not a category — so never a hierarchy level.
 *
 * A level is a THING other things sit inside: a building, a floor, a management group. A quantity
 * is never an ancestor of anything. Without this, a column of metres whose value is mostly `0`
 * looks exactly like a category to a distinct-count test: on a real municipal green-space register
 * `WATERRANDLENGTE` (water edge length) had 7 distinct values across 60 rows and was proposed as
 * the third level of the hierarchy, between a management group and a planting decade.
 *
 * Deliberately not applied to the MAPPING — a number is a perfectly good property value. Only the
 * level suggester needs this, because only it is trying to infer meaning from shape.
 *
 * A comma decimal (`19,91`) counts as numeric: the sheets this exists for are European.
 */
const looksNumeric = (value: string) => /^-?\d+([.,]\d+)?$/.test(value.trim())

function isMeasurement(values: readonly string[]): boolean {
  if (values.length === 0) return false
  const numeric = values.filter(looksNumeric).length
  return numeric >= values.length * 0.9
}

/**
 * U+0000 as an escape, never the literal byte.
 *
 * The byte itself sat at offset 2591 — inside git's 8000-byte binary-detection window — so this
 * file reported "Binary files differ" and could not be reviewed in a diff at all.
 *
 * The separator must stay U+0000: it joins cell values to count distinct combinations, so any
 * character that can appear IN a cell would let two different combinations collide and undercount.
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
 * Columns that describe a HIERARCHY — an ancestor of the row rather than the row itself.
 *
 * Repetition alone is not enough, and getting this wrong is expensive: it decides how many
 * objects are created. On a property register, `Adresse` and `Kataster` repeat exactly as much as
 * `Gebäude` does — one address, one plan per building — so a repetition test alone proposes
 * `Gebäude › Geschoss › Adresse › Kataster`, which would make an address into a floor.
 *
 * The distinguishing test is whether a column SUBDIVIDES what is already there. Adding `Geschoss`
 * under `Gebäude` takes 2 groups to 3, so it is a real level. Adding `Adresse` leaves it at 2, so
 * it carries no information the building did not already have — it is an attribute of the
 * building, and belongs on it via `attachTo`.
 *
 * Still a SUGGESTION. It is offered, never applied.
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
    // Repeats a lot, but is not a single constant (that describes the document, not a level) and
    // is not near-unique (that is the row's own identity).
    if (distinct > 1 && distinct <= Math.max(2, values.length * 0.5)) {
      candidates.push({ column, distinct })
    }
  }

  // Fewest distinct values first: a building has fewer than its floors, which have fewer than
  // their rooms. That ordering IS the nesting.
  candidates.sort((a, b) => a.distinct - b.distinct)

  const levels: number[] = []
  for (const candidate of candidates) {
    const before = levels.length === 0 ? 1 : distinctCombos(rows, levels)
    const after = distinctCombos(rows, [...levels, candidate.column])
    // Keep it only if it splits the groups further. An attribute of an existing level leaves the
    // count unchanged and is dropped.
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
