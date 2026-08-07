/**
 * Wizard dummy data — a property register with the junk a real export carries: a title row, a
 * blank, an "as of" line, then the actual header. That is what the header-row picker exists for.
 *
 * The domain is buildings › floors › rooms, with room-level assets as properties. Every row is a
 * ROOM and repeats its building and floor, which is what makes the hierarchy step necessary.
 */

export interface LabSheet {
  name: string
  rows: number
  columns: number
}

export const LAB_WORKBOOK: LabSheet[] = [
  { name: 'Rooms', rows: 1204, columns: 11 },
  { name: 'Land parcels', rows: 318, columns: 5 },
  { name: 'Legend', rows: 12, columns: 2 },
]

/** Rows 1-3 are preamble; row 4 is the header; data starts at row 5. */
const BLANK = ['', '', '', '', '', '', '', '', '', '', '']

const ADDRESS_NH = '1200 Harbor Boulevard, Portland OR 97204, United States'
const ADDRESS_RD = '88 Mill Lane, Portland OR 97209, United States'
const PLAN_NH_G = 'https://plans.northgate.example/nh-ground.pdf'
const PLAN_NH_1 = 'https://plans.northgate.example/nh-first.pdf'
const PLAN_RD_G = 'https://plans.northgate.example/rd-ground.pdf'

export const LAB_RAW_ROWS: string[][] = [
  ['Property Register — Northgate Estates', ...BLANK.slice(1)],
  BLANK,
  ['As of 1 July 2026', ...BLANK.slice(1)],
  [
    'Building',
    'Floor',
    'Room',
    'Address',
    'Area (m²)',
    'Use',
    'Year Built',
    'Condition',
    'Asset Tags',
    'Materials',
    'Floor Plan',
  ],
  [
    'Northgate House',
    'Ground',
    '101',
    ADDRESS_NH,
    '24',
    'Office; Archive',
    '1974',
    'Good',
    'NH-101-A | NH-101-B',
    'Concrete, Steel',
    PLAN_NH_G,
  ],
  [
    'Northgate House',
    'Ground',
    '102',
    ADDRESS_NH,
    '18',
    'Storage',
    '1974',
    'Fair',
    'NH-102-A',
    'Concrete',
    PLAN_NH_G,
  ],
  [
    'Northgate House',
    'First',
    '201',
    ADDRESS_NH,
    '24',
    'Office',
    '1974',
    'Good',
    'NH-201-A | NH-201-B | NH-201-C',
    'Concrete, Steel, Glass',
    PLAN_NH_1,
  ],
  [
    'Northgate House',
    'First',
    '202',
    ADDRESS_NH,
    '31',
    'Meeting room',
    '1974',
    'Good',
    'NH-202-A',
    'Glass',
    PLAN_NH_1,
  ],
  [
    'Riverside Depot',
    'Ground',
    '101',
    ADDRESS_RD,
    '52',
    'Workshop; Storage',
    '1961',
    'Poor',
    'RD-101-A | RD-101-B',
    'Steel, Timber',
    PLAN_RD_G,
  ],
]

export const HEADER_ROW_INDEX = 3
export const DATA_START_INDEX = 4

export interface LabColumn {
  index: number
  header: string
  samples: string[]
}

export const LAB_COLUMNS: LabColumn[] = [
  {
    index: 0,
    header: 'Building',
    samples: ['Northgate House', 'Northgate House', 'Riverside Depot'],
  },
  { index: 1, header: 'Floor', samples: ['Ground', 'First', 'Ground'] },
  { index: 2, header: 'Room', samples: ['101', '102', '201'] },
  {
    index: 3,
    header: 'Address',
    samples: [ADDRESS_NH, ADDRESS_NH, ADDRESS_RD],
  },
  { index: 4, header: 'Area (m²)', samples: ['24', '18', '52'] },
  {
    index: 5,
    header: 'Use',
    samples: ['Office; Archive', 'Storage', 'Workshop; Storage'],
  },
  { index: 6, header: 'Year Built', samples: ['1974', '1974', '1961'] },
  { index: 7, header: 'Condition', samples: ['Good', 'Fair', 'Poor'] },
  {
    index: 8,
    header: 'Asset Tags',
    samples: [
      'NH-101-A | NH-101-B',
      'NH-102-A',
      'NH-201-A | NH-201-B | NH-201-C',
    ],
  },
  {
    index: 9,
    header: 'Materials',
    samples: ['Concrete, Steel', 'Concrete', 'Steel, Timber'],
  },
  {
    index: 10,
    header: 'Floor Plan',
    samples: [PLAN_NH_G, PLAN_NH_1, PLAN_RD_G],
  },
]

/**
 * Columns whose values REPEAT down the sheet — the signal that they describe a parent rather
 * than the row. Offered as a suggestion the user accepts, never applied for them: turning 1,200
 * rows into 1,847 objects is too big a change to make on a guess nobody agreed to.
 */
export const SUGGESTED_LEVELS = [0, 1, 2]

/**
 * What a mapping decides, per column.
 *
 * Columns not claimed by a fixed field fall through to `properties` — so a column can never be
 * silently dropped, which is what happens today when a header simply goes unmapped.
 */
export interface LabMapping {
  name: number | null
  description: number | null
  address: number | null
  /** Set when the address arrives pre-split instead of in one cell. */
  addressParts: Partial<
    Record<'street' | 'houseNumber' | 'postalCode' | 'city' | 'country', number>
  >
  files: number | null
  /**
   * Core's plan (§6d) defines TWO hierarchy shapes and both reduce to the same envelope:
   * `levels` = repeating columns (Mode B), `key`/`parent` = the sheet already carries ids
   * (Mode A). They are alternatives, so the UI picks one and hides the other.
   */
  hierarchyMode: 'none' | 'levels' | 'keys'
  /** Ordered — the order IS the nesting. */
  levels: number[]
  key: number | null
  parent: number | null
  /**
   * Which hierarchy level a column attaches to, when there is one.
   *
   * Core's plan calls this out: row-level values land on the DEEPEST level, but a column that
   * repeats identically for a whole building describes the building. Without this, an address
   * ends up on every room and the building has none.
   */
  attachTo: Record<number, number>
  /** An EXISTING entity id every root item hangs from, or null for the top level. */
  destination: string | null
  properties: Record<number, { include: boolean; split: string | null }>
}

export const INITIAL_MAPPING: LabMapping = {
  name: null,
  description: null,
  address: 3,
  addressParts: {},
  files: 10,
  // Flat by DEFAULT. A guess that turns 1,200 rows into 1,847 objects is too consequential to
  // arrive pre-applied — it is offered as a suggestion the user accepts instead.
  hierarchyMode: 'none',
  levels: [],
  key: null,
  parent: null,
  // Address, Year Built and the floor plan describe the BUILDING — they repeat identically on
  // every one of its rooms. Left on the default they would land on each room instead, which is
  // the case core's plan calls out. Still overridable per column.
  attachTo: { 3: 0, 6: 0, 10: 0 },
  destination: null,
  properties: {
    4: { include: true, split: null },
    5: { include: true, split: ';' },
    6: { include: true, split: null },
    7: { include: true, split: null },
    8: { include: true, split: '|' },
    9: { include: true, split: ',' },
  },
}

export const DELIMITERS = [
  { value: 'none', label: 'One value' },
  { value: ';', label: 'Split on ;' },
  { value: ',', label: 'Split on ,' },
  { value: '|', label: 'Split on |' },
]

/**
 * A slug that keeps every letter and digit, in any script.
 *
 * `\p{L}\p{N}` with the `u` flag, NOT `\w` — `\w` is `[A-Za-z0-9_]`, so it silently drops
 * accented letters and symbols: `Area (m²)` loses the `²`, and a German header like `Größe`
 * becomes `grse`. The label keeps the original either way, so the UI looks right while search and
 * templates key off a string nobody has ever seen.
 */
export function deriveKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]/gu, '')
}

/**
 * The same slug WITHOUT the character filter — spaces collapsed, nothing removed.
 *
 * Comparing the two is how the mapper tells real mangling from ordinary slugging: `Year Built` →
 * `year_built` drops nothing and needs no warning, while `Area (m²)` → `area_m²` does.
 */
export function faithfulSlug(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

export interface ParsedAddress {
  street?: string
  houseNumber?: string
  postalCode?: string
  city?: string
  state?: string
  country?: string
  /** The name that had to be translated to a code — worth showing, since it is the risky part. */
  countryWasName?: string
  confident: boolean
}

const COUNTRY_NAMES: Record<string, string> = {
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  ireland: 'IE',
  canada: 'CA',
  australia: 'AU',
  netherlands: 'NL',
  germany: 'DE',
}

/**
 * A stand-in for the real parse. The point of the lab is the SHAPE — one cell in, structured
 * address out, shown before anything is written.
 *
 * The country arm is the load-bearing part: io2p stores a 2-letter ISO code, and a sheet says
 * "United States". Translating it here is the difference between an import that works and 1,200
 * rows failing on `address.country must be a 2-letter ISO code`.
 */
export function parseAddress(raw: string): ParsedAddress {
  const parts = raw.split(',').map((p) => p.trim())
  if (parts.length < 2) return { confident: false }

  // English convention puts the number first — "1200 Harbor Boulevard".
  const streetPart = parts[0] ?? ''
  const street = streetPart.match(/^(\d+[a-zA-Z]?)\s+(.*)$/)

  // "Portland OR 97204" — city, optional state code, trailing postcode.
  const locality = (parts[1] ?? '').match(/^(.*?)(?:\s+([A-Z]{2}))?\s+(\d{5})$/)

  const rawCountry = parts[2]?.toLowerCase()
  const mapped = rawCountry ? COUNTRY_NAMES[rawCountry] : undefined

  return {
    houseNumber: street?.[1],
    street: street?.[2] ?? streetPart,
    city: locality?.[1] ?? parts[1],
    state: locality?.[2],
    postalCode: locality?.[3],
    country:
      mapped ??
      (rawCountry?.length === 2 ? rawCountry.toUpperCase() : undefined),
    countryWasName: mapped ? parts[2] : undefined,
    confident: Boolean(street && locality),
  }
}

// ---------------------------------------------------------------------------
// The result grid — what Check shows
// ---------------------------------------------------------------------------

export interface LabCell {
  value: string
  problem?: string
}

export interface LabResultRow {
  /**
   * WHICH sheet rows this object came from — a range, not a number.
   *
   * A parent object is a dedupe of every row that repeated its value, so attributing
   * "Northgate House" to row 5 is simply wrong: it came from rows 5-8 collectively. Only a leaf
   * object maps to a single row, and that is the only one whose failure the operator can fix by
   * editing one line.
   */
  from: string
  level: number
  valid: boolean
  cells: Record<string, LabCell>
}

export const LAB_RESULT_COLUMNS = [
  'Name',
  'Address',
  'area_m²',
  'use',
  'condition',
  'asset_tags',
  'materials',
  'Files',
] as const

export const LAB_RESULT_ROWS: LabResultRow[] = [
  {
    from: 'rows 5–8',
    level: 0,
    valid: true,
    cells: {
      Name: { value: 'Northgate House' },
      Address: { value: '1200 Harbor Boulevard, Portland OR 97204, US' },
      'area_m²': { value: '' },
      use: { value: '' },
      condition: { value: '' },
      asset_tags: { value: '' },
      materials: { value: '' },
      Files: { value: '1 link' },
    },
  },
  {
    from: 'rows 5–6',
    level: 1,
    valid: true,
    cells: {
      Name: { value: 'Ground' },
      Address: { value: '' },
      'area_m²': { value: '' },
      use: { value: '' },
      condition: { value: '' },
      asset_tags: { value: '' },
      materials: { value: '' },
      Files: { value: '' },
    },
  },
  {
    from: 'row 5',
    level: 2,
    valid: true,
    cells: {
      Name: { value: '101' },
      Address: { value: '' },
      'area_m²': { value: '24' },
      use: { value: 'Office · Archive' },
      condition: { value: 'Good' },
      asset_tags: { value: 'NH-101-A · NH-101-B' },
      materials: { value: 'Concrete · Steel' },
      Files: { value: '' },
    },
  },
  {
    from: 'row 6',
    level: 2,
    valid: false,
    cells: {
      Name: { value: '102' },
      Address: { value: '' },
      'area_m²': { value: '', problem: 'Empty — a value needs data' },
      use: { value: 'Storage' },
      condition: { value: 'Fair' },
      asset_tags: { value: 'NH-102-A' },
      materials: { value: 'Concrete' },
      Files: { value: '' },
    },
  },
  {
    from: 'row 41',
    level: 2,
    valid: false,
    cells: {
      Name: { value: '', problem: 'Blank hierarchy level' },
      Address: { value: '' },
      'area_m²': { value: '19' },
      use: { value: 'Plant room' },
      condition: { value: 'Poor' },
      asset_tags: { value: '' },
      materials: { value: 'Concrete' },
      Files: { value: '' },
    },
  },
  {
    from: 'rows 9–12',
    level: 0,
    valid: false,
    cells: {
      Name: { value: 'Riverside Depot' },
      Address: {
        value: '88 Mill Lane',
        problem: 'No city or postcode found — will import unstructured',
      },
      'area_m²': { value: '' },
      use: { value: '' },
      condition: { value: '' },
      asset_tags: { value: '' },
      materials: { value: '' },
      Files: { value: '1 link' },
    },
  },
]

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

export interface LabDestination {
  id: string
  name: string
  path: string
}

/**
 * "Import everything under this object" needs NO new protocol surface: core's envelope already
 * takes a real entity id in `parents[]` alongside tempIds from the same job, so a destination is
 * just that id on every ROOT item. With hierarchy levels it lands on the top level only, and
 * everything below keeps hanging off its own parent.
 */
export const LAB_DESTINATIONS: LabDestination[] = [
  {
    id: '0190b3f2-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
    name: 'Northgate Estates',
    path: 'Portfolio › US West',
  },
  {
    id: '0190b3f2-2b3c-4d5e-9f60-718293a4b5c6',
    name: 'Portland Sites',
    path: 'Portfolio › US West › Northgate Estates',
  },
  {
    id: '0190b3f2-3c4d-4e5f-a071-8293a4b5c6d7',
    name: 'Imports 2026',
    path: 'Portfolio',
  },
]

// ---------------------------------------------------------------------------
// The tree, COMPUTED
// ---------------------------------------------------------------------------

/** The data rows only — preamble and header stripped. */
export const DATA_ROWS = LAB_RAW_ROWS.slice(DATA_START_INDEX)

export interface TreeNode {
  /** The full path — the identity. `Northgate House/Ground/101`, not `101`. */
  path: string
  name: string
  level: number
  /** 1-based sheet row numbers this node was built from. */
  rows: number[]
}

/**
 * Walk the rows and dedupe each distinct path prefix into one node.
 *
 * This is the whole hierarchy mechanism in nine lines, and it is worth computing rather than
 * asserting: every count the wizard shows is derived from here, so removing a level changes the
 * number on screen. A hardcoded `2 + 3 + 5` kept claiming ten objects after Floor was removed.
 */
export function buildTree(levels: number[]): TreeNode[] {
  if (levels.length === 0) {
    return DATA_ROWS.map((row, i) => ({
      path: String(i),
      name: row[levels[0] ?? 0] ?? `Row ${i + DATA_START_INDEX + 1}`,
      level: 0,
      rows: [i + DATA_START_INDEX + 1],
    }))
  }

  const byPath = new Map<string, TreeNode>()
  DATA_ROWS.forEach((row, i) => {
    const sheetRow = i + DATA_START_INDEX + 1
    const segments: string[] = []
    levels.forEach((column, level) => {
      const cell = row[column] ?? ''
      segments.push(cell)
      const path = segments.join('/')
      const existing = byPath.get(path)
      if (existing) existing.rows.push(sheetRow)
      else byPath.set(path, { path, name: cell, level, rows: [sheetRow] })
    })
  })
  return [...byPath.values()]
}

/** "row 5" or "rows 5–8" — a parent is a dedupe across rows, so a single number would lie. */
export function rowRange(rows: number[]): string {
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (first === undefined || last === undefined) return '—'
  return first === last ? `row ${first}` : `rows ${first}–${last}`
}
