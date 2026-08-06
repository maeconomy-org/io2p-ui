import { describe, expect, it } from 'vitest'

import {
  type BuildMapping,
  buildItems,
  deriveKey,
} from '@/lib/import/build-items'

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

describe('deriveKey', () => {
  it('keeps letters and digits in ANY script', () => {
    // `\w` is [A-Za-z0-9_], so it drops accents silently: the label still reads "Größe" while
    // search and templates key off "grse". This is the exact bug the old mapper shipped.
    expect(deriveKey('Größe')).toBe('größe')
    expect(deriveKey('Fläche m²')).toBe('fläche_m²')
    expect(deriveKey('Year Built')).toBe('year_built')
  })

  it('never returns an empty key', () => {
    expect(deriveKey('   ')).toBe('column')
    expect(deriveKey('!!!')).toBe('column')
  })
})

describe('buildItems — level columns (rows repeat their ancestors)', () => {
  it('de-duplicates each path prefix into one object', () => {
    const { items, problems } = buildItems(ROWS, levelsMapping(), HEADERS)

    // 4 rows → 2 buildings + 3 floors + 4 rooms = 9 objects. The count is the whole point of
    // this mode: a per-row import would create 4 and lose the tree.
    expect(problems).toEqual([])
    expect(items).toHaveLength(9)
    expect(items.map((i) => i.tempId)).toEqual([
      'Northgate House',
      'Northgate House/Ground',
      'Northgate House/Ground/101',
      'Northgate House/Ground/102',
      'Northgate House/First',
      'Northgate House/First/201',
      'Riverside Depot',
      'Riverside Depot/Ground',
      'Riverside Depot/Ground/101',
    ])
  })

  it('links every child to its parent by tempId, and leaves roots parentless', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const byId = new Map(items.map((i) => [i.tempId, body(i)]))

    expect(byId.get('Northgate House')?.parents).toBeUndefined()
    expect(byId.get('Northgate House/Ground')?.parents).toEqual([
      'Northgate House',
    ])
    expect(byId.get('Northgate House/Ground/101')?.parents).toEqual([
      'Northgate House/Ground',
    ])
  })

  it('uses the LAST path segment as the name, not the whole path', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const room = items.find((i) => i.tempId === 'Northgate House/Ground/101')
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
    expect(byId.get('Northgate House/Ground/101')?.address).toBeUndefined()
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
    const floor = items.find((i) => i.tempId === 'Northgate House/Ground')

    const keys = body(floor!).properties?.map((p) => p.key) ?? []
    expect(keys).not.toContain('building')
    expect(keys).not.toContain('floor')

    // …while a genuine property is untouched. It lands on the ROOM: with three levels the room
    // is the deepest, and an unassigned column attaches to the deepest level.
    const room = items.find((i) => i.tempId === 'Northgate House/Ground/101')
    expect(body(room!).properties?.map((p) => p.key)).toContain('area')
  })

  it('splits a delimited cell into several values', () => {
    const { items } = buildItems(ROWS, levelsMapping(), HEADERS)
    const room = items.find((i) => i.tempId === 'Northgate House/Ground/101')
    const tags = body(room!).properties?.find((p) => p.key === 'tags')
    expect(tags?.values).toEqual([{ data: 'A' }, { data: 'B' }])
  })

  it('refuses a row with a blank level instead of mis-parenting what follows', () => {
    const rows = [...ROWS, ['Northgate House', '', '999', '', '10', '']]
    const { items, problems } = buildItems(rows, levelsMapping(), HEADERS)

    expect(problems).toEqual([
      { row: 5, message: 'Level 2 is blank — every level must have a value' },
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
    expect(byId.get('Northgate House/Ground')?.parents).toEqual([
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

  it('names the row when a parent key does not exist', () => {
    // A typo here would be caught by the node at staging, but the node cannot say which ROW —
    // it never sees the spreadsheet.
    const rows = [...KEY_ROWS, ['B-99', 'B-l2', 'Anbau', 'gross']]
    const { problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(problems[0]?.message).toContain('"B-l2" that no row declares')
  })

  it('refuses a duplicate key rather than merging two rows', () => {
    const rows = [...KEY_ROWS, ['B-12', '', 'Another building', 'gross']]
    const { problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(problems).toEqual([{ row: 4, message: 'Duplicate key "B-12"' }])
  })

  it('refuses a blank name', () => {
    const rows = [['B-1', '', '', 'gross']]
    const { items, problems } = buildItems(rows, keyMapping, KEY_HEADERS)
    expect(items).toHaveLength(0)
    expect(problems).toEqual([{ row: 1, message: 'Name is blank' }])
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
