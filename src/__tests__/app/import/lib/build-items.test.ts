import { describe, expect, it } from 'vitest'

import {
  type BuildMapping,
  buildItems,
  columnLabel,
  deriveKey,
} from '@/app/import/lib/build-items'
import { resolveKey } from '@/constants/property-dictionary'

/**
 * tempIds are level segments joined by U+0000, not '/'. Spelled once here: a test that hardcodes
 * the separator is a test that has to be rewritten to change it, which is how the old '/' survived
 * long enough to start merging objects whose names contained a slash.
 */
const path = (...segments: string[]) => segments.join('\u0000')

/**
 * The builder is where a spreadsheet becomes objects, so it is the one place in the flow where a
 * mistake is permanent: the node's store is append-only, and a wrongly-shaped import can only be
 * soft-deleted afterwards, never removed. It is pure, so it is tested directly.
 */

// A property register with the shape that makes hierarchy necessary: every row is a ROOM and
// repeats its building and floor.
const HEADERS = ['Building', 'Floor', 'Room', 'Address', 'Area', 'Tags']
const ROWS: unknown[][] = [
  ['Northgate House', 'Ground', '101', '1200 Harbor Blvd', '24', 'A | B'],
  ['Northgate House', 'Ground', '102', '1200 Harbor Blvd', '18', 'C'],
  ['Northgate House', 'First', '201', '1200 Harbor Blvd', '31', 'D'],
  ['Riverside Depot', 'Ground', '101', '88 Mill Lane', '52', 'E'],
]

function levelsMapping(over: Partial<BuildMapping> = {}): BuildMapping {
  return {
    columns: {
      3: { kind: 'address' },
      4: { kind: 'property', key: 'area', label: 'Area', split: null },
      5: { kind: 'property', key: 'tags', label: 'Tags', split: '|' },
    },
    levels: [0, 1, 2],
    attachTo: {},
    destination: null,
    ...over,
  }
}

const body = (item: { body: unknown }) =>
  item.body as {
    name: string
    parents?: string[]
    address?: Record<string, string>
    properties?: { key: string; label: string; values: { data: string }[] }[]
    files?: { reference: { url: string } }[]
  }

describe('columnLabel', () => {
  it('uses the header when there is one', () => {
    expect(columnLabel('Fläche m²', 4)).toBe('Fläche m²')
    expect(columnLabel('  Area  ', 0)).toBe('Area')
  })

  it('falls back to a 1-based position for a blank header', () => {
    expect(columnLabel('', 2)).toBe('Column 3')
    expect(columnLabel('   ', 2)).toBe('Column 3')
  })

  it('gives two blank columns DISTINCT property keys', () => {
    const first = deriveKey('', 2)
    const second = deriveKey('', 3)

    expect(first).toBe('column-3')
    expect(second).toBe('column-4')
    expect(first).not.toBe(second)
  })
})

describe('deriveKey', () => {
  it('agrees EXACTLY with the typed property field', () => {
    // The whole point of the function: a rollup rule matches `search.k` verbatim, so an imported
    // column and a hand-typed property of the same name must produce one key, not two that read
    // alike. `year_built` vs `year-built` is what made imported rows unsummable.
    for (const header of ['Year Built', 'Energy Consumption', 'Concrete Mass'])
      expect(deriveKey(header)).toBe(resolveKey(header).key)
  })

  it('resolves a known term through the dictionary, in either language', () => {
    expect(deriveKey('Gewicht')).toBe('weight')
    expect(deriveKey('Weight')).toBe('weight')
  })

  it('transliterates letters that survive diacritic-stripping', () => {
    // NFD leaves ß and æ whole, so the ASCII filter would DELETE them: `Größe` keyed as `gro-e`.
    expect(deriveKey('Größe')).toBe('grosse')
    expect(deriveKey('Fläche m²')).toBe('flache-m2')
  })

  it('converges spellings that differ only by accent', () => {
    // Off-dictionary, so both fall to `slug` — which is where the diacritic guarantee lives. A
    // dictionary TERM is matched literally, so an accented misspelling of one resolves by slug
    // instead of to the canonical key; that gap is `findExactTerm`'s, not this function's.
    expect(deriveKey('Vloerafwérking')).toBe(deriveKey('Vloerafwerking'))
  })

  it('never returns an empty key', () => {
    // `slug` yields '' here; an empty key is not storable, so the position stands in.
    expect(deriveKey('   ', 0)).toBe('column-1')
    expect(deriveKey('!!!', 4)).toBe('column-5')
    expect(deriveKey('日本語', 1)).toBe('column-2')
    expect(deriveKey('   ')).toBe('column')
  })
})

describe('buildItems — level columns (rows repeat their ancestors)', () => {
  it('keeps two objects apart when a name contains the old separator', () => {
    // Building `Blok A/B` floor `C` vs building `Blok A` floor `B/C`: joined by '/' both become
    // "Blok A/B/C", so the two DIFFERENT buildings and their floors silently merged into one
    // object each. Slashes in municipal block names are ordinary.
    const rows: unknown[][] = [
      ['Blok A/B', 'C', '1', '', '', ''],
      ['Blok A', 'B/C', '2', '', '', ''],
    ]
    const { items } = buildItems(rows, levelsMapping(), HEADERS)

    // 2 buildings + 2 floors + 2 rooms. Under '/' this collapsed to 4.
    expect(items).toHaveLength(6)
    expect(items.map((i) => i.tempId)).toContain(path('Blok A/B', 'C'))
    expect(items.map((i) => i.tempId)).toContain(path('Blok A', 'B/C'))
  })

  it('de-duplicates each path prefix into one object', () => {
    const { items, problems } = buildItems(ROWS, levelsMapping(), HEADERS)

    // 4 rows → 2 buildings + 3 floors + 4 rooms = 9 objects. The count is the whole point of
    // this mode: a per-row import would create 4 and lose the tree.
    expect(problems).toEqual([])
    expect(items).toHaveLength(9)
    expect(items.map((i) => i.tempId)).toEqual([
      'Northgate House',
      path('Northgate House', 'Ground'),
      path('Northgate House', 'Ground', '101'),
      path('Northgate House', 'Ground', '102'),
      path('Northgate House', 'First'),
      path('Northgate House', 'First', '201'),
      'Riverside Depot',
      path('Riverside Depot', 'Ground'),
      path('Riverside Depot', 'Ground', '101'),
    ])
  })

  it('links every child to its parent by tempId, and leaves roots parentless', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const byId = new Map(items.map((i) => [i.tempId, body(i)]))

    expect(byId.get('Northgate House')?.parents).toBeUndefined()
    expect(byId.get(path('Northgate House', 'Ground'))?.parents).toEqual([
      'Northgate House',
    ])
    expect(byId.get(path('Northgate House', 'Ground', '101'))?.parents).toEqual(
      [path('Northgate House', 'Ground')]
    )
  })

  it('uses the LAST path segment as the name, not the whole path', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const room = items.find(
      (i) => i.tempId === path('Northgate House', 'Ground', '101')
    )
    expect(body(room!).name).toBe('101')
  })

  it('attaches a value to the level it was assigned, not the deepest', () => {
    // The address repeats identically on every row of a building, so it describes the BUILDING.
    // Left on the default it would be written onto all four rooms and the building would have
    // none — the case that makes `attachTo` necessary rather than a refinement.
    const { items } = buildItems(
      ROWS,
      levelsMapping({ attachTo: { 3: 0 } }),
      HEADERS
    )
    const byId = new Map(items.map((i) => [i.tempId, body(i)]))

    expect(byId.get('Northgate House')?.address).toEqual({
      fullAddress: '1200 Harbor Blvd',
    })
    expect(
      byId.get(path('Northgate House', 'Ground', '101'))?.address
    ).toBeUndefined()
  })

  it('does not repeat a level column as a property', () => {
    // A level column is already expressed twice — as the object's name and as its place in the
    // tree. Writing it a third time as a property gives every floor a `building: Northgate
    // House` beside a parent link saying the same thing, on every imported object.
    const mapping = levelsMapping({
      columns: {
        ...levelsMapping().columns,
        0: {
          kind: 'property',
          key: 'building',
          label: 'Building',
          split: null,
        },
        1: { kind: 'property', key: 'floor', label: 'Floor', split: null },
      },
    })
    const { items } = buildItems(ROWS, mapping, HEADERS)
    const floor = items.find(
      (i) => i.tempId === path('Northgate House', 'Ground')
    )

    const keys = body(floor!).properties?.map((p) => p.key) ?? []
    expect(keys).not.toContain('building')
    expect(keys).not.toContain('floor')

    // …while a genuine property is untouched. It lands on the ROOM: with three levels the room
    // is the deepest, and an unassigned column attaches to the deepest level.
    const room = items.find(
      (i) => i.tempId === path('Northgate House', 'Ground', '101')
    )
    expect(body(room!).properties?.map((p) => p.key)).toContain('area')
  })

  it('splits a delimited cell into several values', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const room = items.find(
      (i) => i.tempId === path('Northgate House', 'Ground', '101')
    )
    const tags = body(room!).properties?.find((p) => p.key === 'tags')
    expect(tags?.values).toEqual([{ data: 'A' }, { data: 'B' }])
  })

  it('refuses a row with a blank level instead of mis-parenting what follows', () => {
    const rows = [...ROWS, ['Northgate House', '', '999', '', '10', '']]
    const { items, problems } = buildItems(rows, levelsMapping(), HEADERS)

    expect(problems).toEqual([
      { row: 5, key: 'import.problem.levelBlank', values: { level: 2 } },
    ])
    expect(items).toHaveLength(9) // the good rows still build
  })

  it('hangs every ROOT under the destination, and nothing else', () => {
    const id = '0190b3f2-4c1a-7e3b-9a2d-0f1c2b3a4d5e'
    const { items } = buildItems(
      ROWS,
      levelsMapping({ destination: id }),
      HEADERS
    )
    const byId = new Map(items.map((i) => [i.tempId, body(i)]))

    expect(byId.get('Northgate House')?.parents).toEqual([id])
    expect(byId.get('Riverside Depot')?.parents).toEqual([id])
    // A child still hangs off its own parent — the destination is not a second parent for all.
    expect(byId.get(path('Northgate House', 'Ground'))?.parents).toEqual([
      'Northgate House',
    ])
  })
})

describe('buildItems — key/parent columns (the sheet carries ids)', () => {
  const KEY_HEADERS = ['id', 'parent_id', 'Name', 'Größe']
  const KEY_ROWS: unknown[][] = [
    ['B-12', '', 'Gebäude Hauptstrasse 12', 'gross'],
    ['B-12-EG', 'B-12', 'Geschoss EG', 'mittel'],
    ['B-12-EG-A', 'B-12-EG', 'Raum A', 'klein'],
  ]
  const keyMapping: BuildMapping = {
    columns: {
      0: { kind: 'key' },
      1: { kind: 'parent' },
      2: { kind: 'name' },
      3: { kind: 'property', key: 'größe', label: 'Größe', split: null },
    },
    levels: [],
    attachTo: {},
    destination: null,
  }

  it('is one row, one object — with the sheet’s own keys as tempIds', () => {
    const { items, problems } = buildItems(KEY_ROWS, keyMapping, KEY_HEADERS)

    expect(problems).toEqual([])
    expect(items.map((i) => i.tempId)).toEqual(['B-12', 'B-12-EG', 'B-12-EG-A'])
    expect(body(items[1]!).parents).toEqual(['B-12'])
    expect(body(items[2]!).parents).toEqual(['B-12-EG'])
  })

  it('keeps the original key on a non-ASCII header', () => {
    const { items } = buildItems(KEY_ROWS, keyMapping, KEY_HEADERS)
    expect(body(items[0]!).properties?.[0]).toMatchObject({
      key: 'größe',
      label: 'Größe',
      values: [{ data: 'gross' }],
    })
  })

  // These three assert `items` as well as `problems`. The original asserted only `problems`, which
  // is exactly why nobody noticed the orphan row was being REPORTED as skipped and SENT anyway.
  it('drops a row whose parent is neither in the sheet nor an object id', () => {
    // `B-l2` is a typo for `B-12` (letter l for one). Core refuses the whole job over this at
    // staging, so the row must not be sent — and the operator needs the line to go and fix.
    const rows = [...KEY_ROWS, ['B-99', 'B-l2', 'Anbau', 'gross']]
    const { items, problems } = buildItems(rows, keyMapping, KEY_HEADERS)

    expect(problems).toHaveLength(1)
    expect(problems[0]?.key).toBe('import.problem.parentUnresolved')
    expect(problems[0]?.values).toEqual({ parent: 'B-l2' })
    expect(problems[0]?.row).toBeGreaterThan(0)
    expect(items.map((i) => i.tempId)).not.toContain('B-99')
  })

  // KEYS MODE deliberately. In levels mode a parent is a path prefix created earlier in the same
  // walk, so it is in `drafts` by construction and this can never happen — a levels-shaped fixture
  // passes no matter what the orphan pass does.
  it('drops the whole chain below a refused parent, not just the first row', () => {
    // A → a typo (dropped). B → A. C → B. The single pass tested `drafts.has('A')`, which was
    // still true because nothing was removed from the map, so B and C shipped with parents that
    // were not in `items` — and core refused the entire job, the outcome this exists to prevent.
    const rows = [
      ['A', 'B-l2', 'Anbau', 'gross'],
      ['B', 'A', 'Etage', 'gross'],
      ['C', 'B', 'Raum', 'gross'],
    ]
    const { items, problems } = buildItems(rows, keyMapping, KEY_HEADERS)

    expect(items).toEqual([])
    expect(problems.map((p) => p.key)).toEqual([
      'import.problem.parentUnresolved',
      'import.problem.parentDropped',
      'import.problem.parentDropped',
    ])
    // Each names its OWN row, so all three are actionable.
    expect(problems.map((p) => p.row)).toEqual([1, 2, 3])
  })

  it('says the parent was refused, not that it is missing, for a cascaded row', () => {
    // B's parent WAS declared. Reporting "not a row in this sheet" would send the operator
    // looking for a typo that is not there.
    const rows = [
      ['A', 'nope', 'Anbau', 'gross'],
      ['B', 'A', 'Etage', 'gross'],
    ]
    const { problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(problems[1]).toEqual({
      row: 2,
      key: 'import.problem.parentDropped',
      values: { parent: 'A' },
    })
  })

  it('passes a UUID parent through as a real object id', () => {
    // Core's envelope takes an existing object id in parents[] beside the job's tempIds — the same
    // mechanism `destination` uses. A sheet whose parent column holds real ids is legitimate, and
    // was being refused wholesale.
    const existing = '0190b3f2-4c1a-7e3b-9a2d-0f1c2b3a4d5e'
    const rows = [...KEY_ROWS, ['B-99', existing, 'Anbau', 'gross']]
    const { items, problems } = buildItems(rows, keyMapping, KEY_HEADERS)

    expect(problems).toEqual([])
    expect(body(items.find((i) => i.tempId === 'B-99')!).parents).toEqual([
      existing,
    ])
  })

  it('reports the real file line, not the position in the data slice', () => {
    // The builder receives rows ALREADY sliced past the header, so counting them gives "row 1"
    // for what the operator sees as row 7. The parser's numbers are the answer.
    const rows = [['', '', '', '']]
    const { problems } = buildItems(rows, keyMapping, KEY_HEADERS, [7])
    expect(problems[0]?.row).toBe(7)
  })

  it('refuses a duplicate key rather than merging two rows', () => {
    const rows = [...KEY_ROWS, ['B-12', '', 'Another building', 'gross']]
    const { problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(problems).toEqual([
      { row: 4, key: 'import.problem.duplicateKey', values: { key: 'B-12' } },
    ])
  })

  it('refuses a blank name', () => {
    const rows = [['B-1', '', '', 'gross']]
    const { items, problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(items).toHaveLength(0)
    expect(problems).toEqual([{ row: 1, key: 'import.problem.nameBlank' }])
  })
})

describe('buildItems — cell handling', () => {
  const one = (rows: unknown[][], mapping: BuildMapping) =>
    body(
      buildItems(rows, mapping, ['Name', 'Value', 'Link']).items[0] ?? {
        body: {},
      }
    )

  const simple: BuildMapping = {
    columns: {
      0: { kind: 'name' },
      1: { kind: 'property', key: 'v', label: 'V', split: null },
      2: { kind: 'fileUrl' },
    },
    levels: [],
    attachTo: {},
    destination: null,
  }

  it('treats an empty cell as ABSENT, never as an empty value', () => {
    // Core requires a value to carry `data`, so `{ data: '' }` fails the row. CSV yields '' and
    // XLSX yields null for the same blank cell, which is why this is normalised here.
    const built = buildItems(
      [
        ['A', '', ''],
        ['B', null, undefined],
      ],
      simple,
      []
    )
    for (const item of built.items) {
      expect(body(item).properties).toBeUndefined()
      expect(body(item).files).toBeUndefined()
    }
  })

  it('accepts a number or a Date without stringifying badly', () => {
    const built = buildItems([['A', 1974, '']], simple, [])
    expect(body(built.items[0]!).properties?.[0]?.values).toEqual([
      { data: '1974' },
    ])
  })

  it('does not repeat a file link that repeats down the sheet', () => {
    // A building's floor plan appears on every one of its rows; without de-duping, a building
    // built from 40 rows would carry the same link 40 times.
    const built = buildItems(
      [
        ['NH', 'Ground', 'https://plans/nh.pdf'],
        ['NH', 'First', 'https://plans/nh.pdf'],
      ],
      {
        columns: { 2: { kind: 'fileUrl' } },
        levels: [0],
        attachTo: {},
        destination: null,
      },
      ['Building', 'Floor', 'Plan']
    )
    expect(body(built.items[0]!).files).toHaveLength(1)
  })

  it('collapses a repeated value but keeps genuinely different ones', () => {
    const built = buildItems(
      [
        ['NH', 'Ground', 'Office'],
        ['NH', 'First', 'Office'],
        ['NH', 'Second', 'Storage'],
      ],
      {
        columns: {
          2: { kind: 'property', key: 'use', label: 'Use', split: null },
        },
        levels: [0],
        attachTo: {},
        destination: null,
      },
      ['Building', 'Floor', 'Use']
    )
    expect(body(built.items[0]!).properties?.[0]?.values).toEqual([
      { data: 'Office' },
      { data: 'Storage' },
    ])
  })

  it('omits every optional section rather than sending empty arrays', () => {
    const built = one([['Just a name', '', '']], simple)
    expect(built).toEqual({ name: 'Just a name' })
  })
})

describe('buildItems — sourceRef', () => {
  const keyHeaders = ['Key', 'Parent', 'Name']
  const keyMapping: BuildMapping = {
    columns: {
      0: { kind: 'key' },
      1: { kind: 'parent' },
      2: { kind: 'name' },
    },
    levels: [],
    attachTo: {},
    destination: null,
  }

  it('names the real file line, which is not the item position', () => {
    const rows = [
      ['B-1', '', 'Anbau'],
      ['B-2', '', 'Etage'],
    ]
    // The parser reports rows 7 and 8: a header at 6, and five lines of preamble above it.
    const { items } = buildItems(rows, keyMapping, keyHeaders, [7, 8])

    expect(items.map((i) => i.sourceRef)).toEqual(['7', '8'])
  })

  it('names the row a level object was FIRST seen on, not the last', () => {
    const { items } = buildItems(
      ROWS,
      levelsMapping(),
      HEADERS,
      [10, 11, 12, 13]
    )
    const northgate = items.find((i) => i.tempId === 'Northgate House')

    expect(northgate?.sourceRef).toBe('10')
  })
})
