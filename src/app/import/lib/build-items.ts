/**
 * Mapped spreadsheet rows → the node's import envelope.
 *
 * Core's envelope is deliberately dumb — an item is a `tempId`, a type and an ordinary create
 * body, with `parents` naming either a tempId from the same job or a real object id. So every
 * spreadsheet concept resolves HERE: "levels", "repeating columns" and "the deepest row wins" are
 * vocabulary the node has never heard of and must not.
 */

import type { ImportItemInput } from 'io2p-client'

import { resolveKey } from '@/constants/property-dictionary'

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
   * Hierarchy from REPEATING columns, outermost first: `[Building, Floor, Room]`. Every row is a
   * leaf repeating its ancestors, so rows de-duplicate by path prefix into one object per value.
   */
  levels: number[]
  /**
   * Which hierarchy level a column's value attaches to. The default is the DEEPEST — right for a
   * room's area, wrong for an address, which the row asserts for every object on the path it
   * names. `ATTACH_EVERY_LEVEL` writes it to all of them.
   */
  attachTo: Record<number, number>
  /** An existing object every ROOT item hangs under. */
  destination: string | null
}

/** An `attachTo` level meaning "every object on the row's path", not one of them. */
export const ATTACH_EVERY_LEVEL = -1

/** A row the builder refused, addressed by its line in the file. */
export interface BuildProblem extends ImportMessage {
  row: number
}

export interface BuildResult {
  items: ImportItemInput[]
  /** Rows the builder refused, with the reason. Never silently dropped. */
  problems: BuildProblem[]
}

/**
 * Level-path separator. U+0000, never `/`: a path is identity, so a separator that can appear IN a
 * cell lets two paths collide — building `Blok A/B` + floor `C` and building `Blok A` + floor
 * `B/C` produce one tempId and the objects merge. No spreadsheet cell contains a NUL.
 */
const PATH_SEP = '\u0000'

/**
 * A tempId as a HUMAN reads it. EVERY screen showing one must go through this — a browser renders
 * U+0000 as zero pixels, so the raw id displays as `Northgate HouseEGA`.
 *
 * ` / ` reintroduces the ambiguity the NUL exists to prevent. Accepted here and only here: this
 * string is read, never compared and never sent. Identity keeps the NUL.
 */
export function formatTempId(tempId: string | undefined): string {
  return (tempId ?? '').split(PATH_SEP).join(' / ')
}

/**
 * A parent reference may name an object that already exists rather than a row in this sheet —
 * core's `parents[]` takes either, so a parent column holding real ids is legitimate.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A cell arrives as a string, a number, or a Date (ExcelJS). Empty means ABSENT, not an empty
// value: core rejects `{ data: '' }` per row.
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
 * The property label PERSISTED to the node. Never translated — running the wizard in Dutch would
 * write `Kolom 3` into an append-only store. The on-screen name is `import.map.unnamedColumn`.
 */
export function columnLabel(header: string, index: number): string {
  return header.trim() || `Column ${index + 1}`
}

/**
 * The key a spreadsheet column is stored under — the SAME resolution the typed property field
 * applies, via `resolveKey`.
 *
 * It has to be identical, not merely similar: a rollup rule matches `search.k` exactly, and core
 * lowercases the key and does nothing else. An import that spelled `year_built` where the property
 * field writes `year-built` produced rows no rule could ever sum, while both spellings looked
 * correct on screen. Going through the dictionary also earns the import cross-language convergence
 * for free — a Dutch `Gewicht` column now lands on `weight` alongside an English one.
 *
 * `slug` returns '' for a header with nothing ASCII-able in it (CJK, emoji), which is not storable —
 * hence the positional fallback, which also keeps two blank headers apart.
 */
export function deriveKey(header: string, index?: number): string {
  const resolved = resolveKey(header.trim()).key
  if (resolved) return resolved
  return index === undefined ? 'column' : `column-${index + 1}`
}

/** The body under construction — accumulated across the rows that share a hierarchy path. */
interface Draft {
  tempId: string
  name: string
  level: number
  parentTempId: string | null
  /**
   * The sheet row this draft was FIRST seen on, so a problem found after the row loop — an
   * unresolvable parent — can still name a line the operator can open.
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
      // A building's plan repeats on every one of its rows: without de-duping, a building built
      // from 40 rows carries the same link 40 times.
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
 * Build the envelope. Two hierarchy shapes, one output — core sees only the item list either way:
 *
 *   • LEVELS — repeating columns, de-duplicated by path prefix, so 3 rows over
 *     `Building/Floor/Room` become 1 + 2 + 3 = 6 objects.
 *   • KEYS — the sheet carries ids; the parent column names another row's key. One row, one object.
 *   • Neither — one row, one object, flat.
 */
export function buildItems(
  rows: readonly unknown[][],
  mapping: BuildMapping,
  headers: readonly string[] = [],
  /**
   * The real file line for each row, index-aligned with `rows`. Optional so tests can pass rows
   * alone, but the app must supply it: `rows` is already sliced to the DATA row, so `index + 1`
   * reports "row 1" for what the operator sees as row 7.
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
    const sheetRow = rowNumbers[index] ?? index + 1

    if (useLevels) {
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
        // A level column is already the object's name and its place in the tree; writing it as a
        // property too gives every floor a `gebäude: Northgate House` beside its own parent link.
        if (mapping.levels.includes(column)) continue
        const level = mapping.attachTo[column]
        if (level === ATTACH_EVERY_LEVEL) {
          // The row asserts this value for the whole path it names, so every object on that path
          // carries it: a room found on its own still says where it physically is, without
          // walking up its parents.
          for (let depth = 0; depth < segments.length; depth++) {
            const owner = drafts.get(
              segments.slice(0, depth + 1).join(PATH_SEP)
            )
            if (owner)
              applyCell(owner, target, row[column], headers[column] ?? '')
          }
          continue
        }
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

  // An unsatisfiable parent makes core refuse the WHOLE job at staging, so these rows are dropped
  // here rather than sent.
  //
  // A FIXPOINT, not one pass: dropping a row orphans its children, and theirs, to unbounded depth.
  // Testing `drafts.has(parent)` in a single pass reads a map this loop never deletes from, so a
  // child of a dropped row still looks satisfied and ships with a dangling parent.
  //
  // O(n²) accepted: a row is recognised only once its parent is marked, so a sheet listing children
  // above their parents resolves one per scan. A children index would make it linear.
  const orphans = new Set<string>()
  for (let changed = true; changed; ) {
    changed = false
    for (const draft of drafts.values()) {
      if (orphans.has(draft.tempId)) continue
      const parent = draft.parentTempId
      // A UUID is a real object id, not declared by any row — never missing. Whether the caller
      // may read it is core's answer, not ours.
      if (!parent || UUID_RE.test(parent)) continue

      const missing = !drafts.has(parent)
      if (!missing && !orphans.has(parent)) continue

      orphans.add(draft.tempId)
      changed = true
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
