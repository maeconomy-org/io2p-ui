import { describe, expect, it } from 'vitest'

import {
  suggestLevels,
  suggestMapping,
  suggestSplit,
} from '@/app/import/lib/suggest-mapping'

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

  // Split into one test per language, because the single test that used to cover both was named
  // "German and Dutch" and every header in it was GERMAN. `straat` and `plaats` were missing from
  // the word list for months behind a green assertion that never looked at them — a test name is
  // not coverage.
  it('recognises German headers, not only English', () => {
    // The data this feature exists for is municipal, and rarely in English.
    const { columns } = suggestMapping(
      ['Bezeichnung', 'Straße', 'Hausnummer', 'PLZ', 'Ort', 'Bundesland'],
      [['Haus', 'Hauptstrasse', '8', '8001', 'Zurich', 'Zürich']]
    )
    expect(columns[0]).toEqual({ kind: 'name' })
    expect(columns[1]).toEqual({ kind: 'addressPart', part: 'street' })
    expect(columns[2]).toEqual({ kind: 'addressPart', part: 'houseNumber' })
    expect(columns[3]).toEqual({ kind: 'addressPart', part: 'postalCode' })
    expect(columns[4]).toEqual({ kind: 'addressPart', part: 'city' })
    expect(columns[5]).toEqual({ kind: 'addressPart', part: 'state' })
  })

  it('recognises Dutch headers', () => {
    const { columns } = suggestMapping(
      ['Naam', 'Straat', 'Huisnummer', 'Postcode', 'Plaats', 'Provincie'],
      [['Pand', 'Harborlaan', '12', '3811 LM', 'Amersfoort', 'Utrecht']]
    )
    expect(columns[0]).toEqual({ kind: 'name' })
    expect(columns[1]).toEqual({ kind: 'addressPart', part: 'street' })
    expect(columns[2]).toEqual({ kind: 'addressPart', part: 'houseNumber' })
    expect(columns[3]).toEqual({ kind: 'addressPart', part: 'postalCode' })
    expect(columns[4]).toEqual({ kind: 'addressPart', part: 'city' })
    expect(columns[5]).toEqual({ kind: 'addressPart', part: 'state' })
  })

  it('does not guess a municipality into the city field', () => {
    // `gemeente` is a different administrative level from the town. Mapping it to `city` would put
    // a wrong value in a field that then looks perfectly filled in.
    const { columns } = suggestMapping(
      ['Naam', 'Gemeente'],
      [['Pand', 'Amersfoort']]
    )
    expect(columns[1]).not.toEqual({ kind: 'addressPart', part: 'city' })
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
      key: 'area-m2', // NOT `area-m` — the ² transliterates rather than vanishing
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

  it('never proposes a MEASUREMENT as a level, however much it repeats', () => {
    // From a real Dutch green-space register. `WATERRANDLENGTE` is a water-edge length in metres
    // and is `0` on most rows, so its distinct count looks exactly like a category's — it was
    // proposed as the third level, between a management group and a planting decade. A quantity
    // is never an ancestor of anything.
    const rows = Array.from({ length: 60 }, (_, i) => [
      ['Bodembedekkers', 'Hagen', 'Bosplantsoen'][i % 3]!,
      i % 10 === 0 ? String((i * 1.1).toFixed(2)) : '0', // WATERRANDLENGTE
    ])
    expect(suggestLevels(rows, 2)).not.toContain(1)
  })

  it('treats a comma decimal as a number too — these sheets are European', () => {
    const rows = Array.from({ length: 60 }, (_, i) => [
      ['A', 'B', 'C'][i % 3]!,
      i % 10 === 0 ? `${i},5` : '0',
    ])
    expect(suggestLevels(rows, 2)).not.toContain(1)
  })

  it('still finds a real hierarchy of names', () => {
    // The guard must not cost the case the feature exists for.
    const rows = [
      ['Noordpoort', 'BG', '101'],
      ['Noordpoort', 'BG', '102'],
      ['Noordpoort', '1e', '201'],
      ['Zuidhaven', 'BG', '101'],
      ['Zuidhaven', '1e', '201'],
    ]
    expect(suggestLevels(rows, 3)).toContain(0)
    expect(suggestLevels(rows, 3)).toContain(1)
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

  it('drops a column that repeats but SUBDIVIDES nothing', () => {
    // The case a repetition test alone gets wrong, and it is expensive: it decides how many
    // objects are created. On a real register `Address` repeats exactly as much as `Building` —
    // one address per building — so repetition alone proposes it as a level under Building, and
    // an address becomes a floor.
    //
    // Building(2) → +Floor makes 3 groups, so Floor is a real level. +Address leaves it at 2, so
    // it carries nothing Building did not already have.
    const rows = [
      ['Northgate', 'Ground', '1200 Harbor Blvd'],
      ['Northgate', 'First', '1200 Harbor Blvd'],
      ['Riverside', 'Ground', '88 Mill Lane'],
      ['Riverside', 'Ground', '88 Mill Lane'],
    ]
    const levels = suggestLevels(rows, 3)
    expect(levels).toContain(0)
    expect(levels).toContain(1)
    expect(levels).not.toContain(2) // the address is an ATTRIBUTE of the building
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
