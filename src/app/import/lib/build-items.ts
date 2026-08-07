/**
 * The BUILDER: mapped spreadsheet rows → the node's import envelope.
 *
 * This is where the whole feature is decided. Everything upstream is a picker; everything
 * downstream is transport. Core keeps its envelope deliberately dumb — an item is a `tempId`, a
 * type and an ordinary create body, with `parents` naming either a tempId from the same job or a
 * real object id — so every spreadsheet concept has to be resolved HERE. "Levels", "repeating
 * columns", "the deepest row wins" are vocabulary the node has never heard of and must not.
 *
 * Pure and synchronous: no React, no client, no IO. That is what lets it be unit-tested against
 * awkward sheets directly, which matters more here than anywhere else in the flow — a mistake
 * lands as objects in an append-only store, where it can only ever be soft-deleted.
 */

import type { ImportItemInput } from 'io2p-client'

import type { ImportMessage } from './messages'

/** Where a column's value goes. `null` means the column is not mapped. */
export type ColumnTarget =
  | { kind: 'name' }
  | { kind: 'description' }
  | { kind: 'address' }
  | { kind: 'addressPart'; part: AddressPart }
  | { kind: 'fileUrl' }
  | { kind: 'key' }
  | { kind: 'parent' }
  | { kind: 'property'; key: string; label: string; split: string | null }

export type AddressPart =
  | 'street'
  | 'houseNumber'
  | 'postalCode'
  | 'city'
  | 'state'
  | 'country'

export interface BuildMapping {
  /** Column index → what it becomes. */
  columns: Record<number, ColumnTarget>
  /**
   * Hierarchy from REPEATING columns, outermost first: `[Building, Floor, Room]`.
   *
   * The commoner municipal shape. Every row is a leaf and repeats its ancestors, so the rows
   * must be de-duplicated by path prefix into one object per distinct value.
   */
  levels: number[]
  /**
   * Which hierarchy level a column's value attaches to.
   *
   * Without this, a value lands on the DEEPEST level, which is right for a room's area and wrong
   * for the building's address — that repeats identically on every one of its rows, so it would
   * be written onto every room and the building would have none.
   */
  attachTo: Record<number, number>
  /** An existing object every ROOT item hangs under. */
  destination: string | null
}

/**
 * A row the builder refused, addressed by its line in the file.
 *
 * The reason is a KEY, not a sentence: this module is pure and must not reach for a locale, and a
 * test that asserts `problem.key` survives a copy edit that one asserting prose does not.
 */
export interface BuildProblem extends ImportMessage {
  row: number
}

export interface BuildResult {
  items: ImportItemInput[]
  /** Rows the builder refused, with the reason. Never silently dropped. */
  problems: BuildProblem[]
}

/**
 * Joins the segments of a level path into a tempId.
 *
 * U+0000, not `/`. A path is identity here — `Northgate House/EG/A` addresses one object — so a
 * separator that can appear IN a cell lets two different paths collide: a building literally named
 * `Blok A/B` with floor `C` produced the same tempId as building `Blok A` with floor `B/C`, and
 * the two objects silently MERGED into one. No spreadsheet cell contains a NUL.
 */
const PATH_SEP = '\u0000'

/**
 * A tempId as a HUMAN reads it. Every screen that shows one must go through this.
 *
 * U+0000 is right for identity and travels to core intact, but a browser renders it as NOTHING —
 * so `Northgate House<NUL>EG<NUL>A` displayed as `Northgate HouseEGA`, and the same raw bytes went
 * into a CSV beside the BOM added so Excel would behave. The separator exists to stop two distinct
 * paths colliding; unrendered, the collision came straight back at the display layer.
 *
 * ` / ` reintroduces exactly that ambiguity for a building literally named `Blok A/B`. Accepted
 * HERE and only here: this string is read, never compared and never sent. Identity keeps the NUL.
 */
export function formatTempId(tempId: string | undefined): string {
  // Optional on the DTO, so the callers do not each need their own guard.
  return (tempId ?? '').split(PATH_SEP).join(' / ')
}

/**
 * Does this parent reference name an object that already exists, rather than a row in this sheet?
 *
 * Core's envelope takes either in `parents[]`, so a sheet whose parent column holds real object
 * ids is legitimate — it is the same mechanism `destination` uses. Without this check every one of
 * those rows was reported as naming a parent "no row declares".
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A cell can arrive as a string, a number, or a Date (ExcelJS). Anything empty is ABSENT, not
// an empty value: core requires a value to carry `data`, so `{ data: '' }` is rejected per row.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

/** Split one cell into many values on a delimiter — `NH-1 | NH-2` is two values, not one string. */
function splitValues(text: string, split: string | null): string[] {
  if (!split) return text ? [text] : []
  return text
    .split(split)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * A key that keeps every letter and digit, in ANY script.
 *
 * `\p{L}\p{N}` with the `u` flag, never `\w` — `\w` is `[A-Za-z0-9_]`, so it silently drops
 * accented letters: a German header `Größe` becomes `grse` and `Fläche m²` becomes `flche_m`.
 * The label keeps the original either way, so the UI looks correct while search and templates key
 * off a string nobody has ever seen.
 */
/**
 * The property label PERSISTED to the node. Never translated — running the wizard in Dutch would
 * write `Kolom 3` into an append-only store. The on-screen name is `import.map.unnamedColumn`.
 */
export function columnLabel(header: string, index: number): string {
  return header.trim() || `Column ${index + 1}`
}

export function deriveKey(header: string): string {
  return (
    header
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\p{L}\p{N}_]/gu, '') || 'column'
  )
}

/** The body under construction — accumulated across the rows that share a hierarchy path. */
interface Draft {
  tempId: string
  name: string
  level: number
  parentTempId: string | null
  /**
   * The sheet row this draft was FIRST seen on.
   *
   * Carried so a problem found after the row loop — an unresolvable parent — can still name a line
   * the operator can open. Without it those were reported as row 0, i.e. no row at all, in the one
   * report whose only job is saying where to look.
   */
  sourceRow: number
  description?: string
  address: Record<string, string>
  properties: Map<string, { label: string; values: string[] }>
  files: { kind: 'reference'; label: string; reference: { url: string } }[]
}

function emptyDraft(
  tempId: string,
  name: string,
  level: number,
  parentTempId: string | null,
  sourceRow: number
): Draft {
  return {
    tempId,
    name,
    level,
    parentTempId,
    sourceRow,
    address: {},
    properties: new Map(),
    files: [],
  }
}

/** Merge one cell into a draft. Repeated identical values collapse; genuinely new ones append. */
function applyCell(
  draft: Draft,
  target: ColumnTarget,
  raw: unknown,
  header: string
): void {
  const text = cellText(raw)
  if (!text) return // absent, not empty — see cellText

  switch (target.kind) {
    case 'name':
    case 'key':
    case 'parent':
      return // identity columns are consumed by the hierarchy pass, not written as data
    case 'description': {
      draft.description ??= text
      return
    }
    case 'address': {
      draft.address.fullAddress = text
      return
    }
    case 'addressPart': {
      draft.address[target.part] = text
      return
    }
    case 'fileUrl': {
      // De-dupe: a building's plan repeats on every one of its rows, so without this a building
      // built from 40 rows would carry the same link 40 times.
      if (!draft.files.some((f) => f.reference.url === text)) {
        draft.files.push({
          kind: 'reference',
          label: header || 'File',
          reference: { url: text },
        })
      }
      return
    }
    case 'property': {
      const existing = draft.properties.get(target.key) ?? {
        label: target.label,
        values: [],
      }
      for (const value of splitValues(text, target.split)) {
        if (!existing.values.includes(value)) existing.values.push(value)
      }
      draft.properties.set(target.key, existing)
      return
    }
  }
}

function toItem(draft: Draft, destination: string | null): ImportItemInput {
  const parents: string[] = []
  if (draft.parentTempId) {
    parents.push(draft.parentTempId)
  } else if (destination) {
    // A real object id alongside tempIds is exactly what core's envelope allows, so "import
    // everything under this object" needs no new surface — it is a parent on every root.
    parents.push(destination)
  }

  const properties = [...draft.properties.entries()].map(([key, prop]) => ({
    key,
    label: prop.label,
    values: prop.values.map((data) => ({ data })),
  }))

  return {
    tempId: draft.tempId,
    type: 'object',
    // `seq` is the item's position in the envelope, not a sheet row: 4 rows become 9 items.
    sourceRef: String(draft.sourceRow),
    body: {
      name: draft.name,
      ...(draft.description ? { description: draft.description } : {}),
      ...(parents.length > 0 ? { parents } : {}),
      ...(Object.keys(draft.address).length > 0
        ? { address: draft.address }
        : {}),
      ...(properties.length > 0 ? { properties } : {}),
      ...(draft.files.length > 0 ? { files: draft.files } : {}),
    },
  } as ImportItemInput
}

/**
 * Build the envelope.
 *
 * Two hierarchy shapes, one output. Core sees only the item list either way, and has no notion of
 * which shape produced it:
 *
 *   • LEVELS — repeating columns. Rows are de-duplicated by path prefix, so 3 rows over
 *     `Building/Floor/Room` become 1 + 2 + 3 = 6 objects.
 *   • KEYS — the sheet already carries ids. One row is one object; the parent column names
 *     another row's key.
 *   • Neither — one row, one object, flat.
 */
export function buildItems(
  rows: readonly unknown[][],
  mapping: BuildMapping,
  headers: readonly string[] = [],
  /**
   * The real file line for each row, from the parser. Index-aligned with `rows`.
   *
   * Optional so the pure tests can pass rows alone, but the app always supplies it: `rows` here is
   * already a slice starting at the DATA row, so counting `index + 1` reports "row 1" for what the
   * operator sees as row 7, and every number in the failure report is off by the header and any
   * preamble above it.
   */
  rowNumbers: readonly number[] = []
): BuildResult {
  const problems: BuildResult['problems'] = []
  const drafts = new Map<string, Draft>()

  const targets = Object.entries(mapping.columns).map(
    ([index, target]) => [Number(index), target] as const
  )
  const keyColumn = targets.find(([, t]) => t.kind === 'key')?.[0]
  const parentColumn = targets.find(([, t]) => t.kind === 'parent')?.[0]
  const nameColumn = targets.find(([, t]) => t.kind === 'name')?.[0]
  const useLevels = mapping.levels.length > 0

  rows.forEach((row, index) => {
    // The number printed in the operator's spreadsheet — the only address they can act on when a
    // row fails. From the parser when we have it; `index + 1` is a fallback for direct callers.
    const sheetRow = rowNumbers[index] ?? index + 1

    if (useLevels) {
      // Walk the levels outermost-first, creating or reusing a draft per distinct path prefix.
      const segments: string[] = []
      let parentTempId: string | null = null
      let deepest: Draft | null = null

      for (const [level, column] of mapping.levels.entries()) {
        const name = cellText(row[column])
        if (!name) {
          // A blank mid-level would silently re-parent everything below it to the wrong node.
          problems.push({
            row: sheetRow,
            key: 'import.problem.levelBlank',
            values: { level: level + 1 },
          })
          deepest = null
          break
        }
        segments.push(name)
        const path = segments.join(PATH_SEP)
        let draft = drafts.get(path)
        if (!draft) {
          draft = emptyDraft(path, name, level, parentTempId, sheetRow)
          drafts.set(path, draft)
        }
        parentTempId = path
        deepest = draft
      }
      if (!deepest) return

      // Non-hierarchy columns land on the level they were assigned, defaulting to the deepest.
      for (const [column, target] of targets) {
        // A LEVEL column is already expressed as the object's name and its place in the tree.
        // Writing it as a property too gives every floor a `gebäude: Northgate House` beside a
        // parent link that says the same thing, and a `geschoss: Erdgeschoss` beside its own
        // name — noise on every imported object, in the section the operator reads first.
        if (mapping.levels.includes(column)) continue
        const level = mapping.attachTo[column]
        const owner =
          level === undefined
            ? deepest
            : (drafts.get(segments.slice(0, level + 1).join(PATH_SEP)) ??
              deepest)
        applyCell(owner, target, row[column], headers[column] ?? '')
      }
      return
    }

    // ── one row, one object ──────────────────────────────────────────────────
    const name = nameColumn === undefined ? '' : cellText(row[nameColumn])
    const key =
      keyColumn === undefined ? `row-${sheetRow}` : cellText(row[keyColumn])
    if (!key) {
      problems.push({ row: sheetRow, key: 'import.problem.keyBlank' })
      return
    }
    if (!name) {
      problems.push({ row: sheetRow, key: 'import.problem.nameBlank' })
      return
    }
    if (drafts.has(key)) {
      problems.push({
        row: sheetRow,
        key: 'import.problem.duplicateKey',
        values: { key },
      })
      return
    }

    const parent = parentColumn === undefined ? '' : cellText(row[parentColumn])
    const draft = emptyDraft(key, name, 0, parent || null, sheetRow)
    drafts.set(key, draft)
    for (const [column, target] of targets) {
      applyCell(draft, target, row[column], headers[column] ?? '')
    }
  })

  // A parent that resolves to neither a row in this sheet nor an existing object can never be
  // satisfied, and core refuses the WHOLE job at staging when it sees one. So these rows are
  // dropped here rather than sent: the alternative is uploading every item and then having the
  // entire import rejected for a typo the user was already shown.
  //
  // A FIXPOINT, not one pass. Dropping a row orphans its children, and theirs, to unbounded
  // depth — and a single pass tested `drafts.has(parent)` against the map it was not removing
  // from, so a child of a dropped row still looked satisfied and shipped with a parent tempId
  // that was no longer in `items`. Core then refused the whole job, which is the exact outcome
  // this block exists to prevent.
  //
  // KEYS MODE ONLY, in practice: a levels-mode parent is a path prefix created earlier in the
  // same walk, so it is in `drafts` by construction and can never be missing.
  //
  // O(n²) accepted: a row is only recognised once its parent is marked, so a sheet listing children
  // ABOVE their parents resolves one per scan. A children index would make it linear.
  const orphans = new Set<string>()
  for (let changed = true; changed; ) {
    changed = false
    for (const draft of drafts.values()) {
      if (orphans.has(draft.tempId)) continue
      const parent = draft.parentTempId
      // A UUID is a real object id, which core's envelope accepts alongside tempIds — the same
      // mechanism `destination` uses. It is not declared by any row and must not be treated as
      // missing. Whether the caller may actually read it is core's answer to give, not ours.
      if (!parent || UUID_RE.test(parent)) continue

      const missing = !drafts.has(parent)
      if (!missing && !orphans.has(parent)) continue

      orphans.add(draft.tempId)
      changed = true
      // Two different facts, so two different sentences. Telling the user their parent "is not a
      // row in this sheet" when it plainly is — it was just refused itself — sends them looking
      // for a typo that is not there.
      problems.push({
        row: draft.sourceRow,
        key: missing
          ? 'import.problem.parentUnresolved'
          : 'import.problem.parentDropped',
        values: { parent },
      })
    }
  }

  return {
    items: [...drafts.values()]
      .filter((d) => !orphans.has(d.tempId))
      .map((d) => toItem(d, mapping.destination)),
    problems,
  }
}

/** How many objects a mapping would create — computed, never guessed. */
export function countItems(
  rows: readonly unknown[][],
  mapping: BuildMapping
): number {
  return buildItems(rows, mapping).items.length
}
