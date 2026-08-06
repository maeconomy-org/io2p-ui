import { describe, expect, it } from 'vitest'

import {
  suggestLevels,
  suggestMapping,
  suggestSplit,
} from '@/lib/import/suggest-mapping'

/**
 * The suggester exists because the old wizard opened with every column set to "Don't Import" —
 * so a column literally named `Name` still had to be mapped by hand, and a 20-column export was
 * 20 decisions before anything could happen.
 */

const HEADERS = [
  'Building',
  'Floor',
  'Room',
  'Address',
  'Area (m²)',
  'Asset Tags',
  'Floor Plan',
]
const ROWS = [
  [
    'Northgate House',
    'Ground',
    '101',
    '1200 Harbor Blvd',
    '24',
    'A | B',
    'https://p/nh.pdf',
  ],
  [
    'Northgate House',
    'Ground',
    '102',
    '1200 Harbor Blvd',
    '18',
    'C | D',
    'https://p/nh.pdf',
  ],
  [
    'Northgate House',
    'First',
    '201',
    '1200 Harbor Blvd',
    '31',
    'E | F',
    'https://p/nh1.pdf',
  ],
  [
    'Riverside Depot',
    'Ground',
    '101',
    '88 Mill Lane',
    '52',
    'G | H',
    'https://p/rd.pdf',
  ],
]

describe('suggestMapping', () => {
  it('recognises a field column by its header', () => {
    const { columns } = suggestMapping(['Name', 'Description'], [['A', 'B']])
    expect(columns[0]).toEqual({ kind: 'name' })
    expect(columns[1]).toEqual({ kind: 'description' })
  })

  it('recognises German and Dutch headers, not only English', () => {
    // The data this feature exists for is municipal, and rarely in English.
    const { columns } = suggestMapping(
      ['Bezeichnung', 'Straße', 'PLZ', 'Ort'],
      [['Haus', 'Hauptstrasse', '8001', 'Zurich']]
    )
    expect(columns[0]).toEqual({ kind: 'name' })
    expect(columns[1]).toEqual({ kind: 'addressPart', part: 'street' })
    expect(columns[2]).toEqual({ kind: 'addressPart', part: 'postalCode' })
    expect(columns[3]).toEqual({ kind: 'addressPart', part: 'city' })
  })

  it('trusts the DATA over the header for links', () => {
    // "Floor Plan" says nothing about files; a column of urls does.
    const { columns } = suggestMapping(HEADERS, ROWS)
    expect(columns[6]).toEqual({ kind: 'fileUrl' })
  })

  it('never leaves a column unmapped — the rest become properties', () => {
    const { columns } = suggestMapping(HEADERS, ROWS)
    // An unmapped column is data the operator brought and the import silently discarded. A
    // property they did not want is one click to remove, and visible while they decide.
    for (let i = 0; i < HEADERS.length; i += 1) {
      expect(columns[i]).toBeDefined()
    }
    expect(columns[4]).toMatchObject({
      kind: 'property',
      key: 'area_m²', // NOT `area_m` — the ² survives
      label: 'Area (m²)',
    })
  })

  it('takes only the FIRST name-like column', () => {
    const { columns } = suggestMapping(['Name', 'Title'], [['A', 'B']])
    expect(columns[0]).toEqual({ kind: 'name' })
    expect(columns[1]).toMatchObject({ kind: 'property' })
  })

  it('offers hierarchy levels but does not apply them', () => {
    const suggestion = suggestMapping(HEADERS, ROWS)
    // Returned separately from `columns` on purpose: accepting it changes how many objects get
    // created, which is too large a change to arrive already made.
    expect(suggestion.suggestedLevels).toContain(0)
    expect(suggestion.suggestedLevels).toContain(1)
  })
})

describe('suggestLevels', () => {
  it('orders levels outermost-first, by how much they repeat', () => {
    // A building has fewer distinct values than its floors, which have fewer than its rooms.
    // That ordering IS the nesting.
    const levels = suggestLevels(ROWS, HEADERS.length)
    expect(levels.indexOf(0)).toBeLessThan(levels.indexOf(1))
  })

  it('ignores a near-unique column — that is identity, not a level', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [`row-${i}`, 'same'])
    expect(suggestLevels(rows, 2)).not.toContain(0)
  })

  it('ignores a single constant — that describes the document, not a level', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ['2026', `row-${i}`])
    expect(suggestLevels(rows, 2)).not.toContain(0)
  })

  it('suggests nothing for a sheet too short to judge', () => {
    expect(suggestLevels([['a'], ['b']], 1)).toEqual([])
  })
})

describe('suggestSplit', () => {
  it('finds a delimiter the cells consistently carry', () => {
    // The node holds many values per property; the old mapper could not reach that at all and
    // sent `A | B` as one string.
    expect(suggestSplit(['A | B', 'C | D', 'E | F'])).toBe('|')
    expect(suggestSplit(['a;b', 'c;d'])).toBe(';')
  })

  it('does not mistake an occasional comma for a list', () => {
    expect(suggestSplit(['1200 Harbor Blvd, Portland', 'Plain'])).toBeNull()
  })

  it('needs more than one sample to judge', () => {
    expect(suggestSplit(['A | B'])).toBeNull()
  })
})
