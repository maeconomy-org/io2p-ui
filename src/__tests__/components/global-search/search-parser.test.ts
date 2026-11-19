import { describe, it, expect } from 'vitest'
import {
  filtersToDisplayString,
  listSearchQuery,
  parseSearchQuery,
  queryWithout,
  searchApplies,
  searchKey,
  templateSearch,
  toListParams,
  type SearchListType,
} from '@/components/global-search/search-parser'
import {
  numberToken,
  unitKeys,
} from '@/components/global-search/search-grammar'

const PARENT = '0192f1d2-7c3a-7b1e-9a4f-123456789abc'

const ALL_TYPES: SearchListType[] = [
  'objects',
  'processes',
  'templates',
  'formulas',
  'constants',
  'shares',
]

const paramsFor = (query: string, type: SearchListType = 'objects') =>
  toListParams(parseSearchQuery(query), type).params

describe('search-parser', () => {
  describe('parseSearchQuery', () => {
    it('should parse a simple text search', () => {
      const result = parseSearchQuery('battery')
      expect(result.searchTerm).toBe('battery')
      expect(result.filters).toHaveLength(1)
      expect(result.filters[0]).toMatchObject({
        type: 'text',
        value: 'battery',
      })
    })

    it('should parse multiple text parts', () => {
      const result = parseSearchQuery('lithium ion battery')
      expect(result.searchTerm).toBe('lithium ion battery')
      expect(result.filters).toHaveLength(3)
    })

    it('should parse deleted:true filter', () => {
      const result = parseSearchQuery('deleted:true battery')
      expect(result.searchTerm).toBe('battery')
      expect(result.filters).toContainEqual(
        expect.objectContaining({
          type: 'deleted',
          value: 'true',
        })
      )
    })

    it('should parse deleted:false filter', () => {
      const result = parseSearchQuery('deleted:false')
      expect(result.filters[0]).toMatchObject({
        type: 'deleted',
        value: 'false',
      })
    })

    it('should parse template filter', () => {
      const result = parseSearchQuery('template:true')
      expect(result.filters[0]).toMatchObject({
        type: 'template',
        value: 'true',
      })
    })

    it('should parse property label filter (prop:label)', () => {
      const result = parseSearchQuery('prop:material')
      expect(result.filters[0]).toMatchObject({
        type: 'propertyLabel',
        propertyKey: 'material',
      })
      expect(result.filters[0].propertyValue).toBeUndefined()
    })

    it('should parse property label and value (prop:label=value)', () => {
      const result = parseSearchQuery('prop:material=steel')
      expect(result.filters[0]).toMatchObject({
        type: 'property',
        propertyKey: 'material',
        propertyValue: 'steel',
      })
    })

    it('should parse property value only (value:xyz)', () => {
      const result = parseSearchQuery('value:active')
      expect(result.filters[0]).toMatchObject({
        type: 'propertyValue',
        propertyValue: 'active',
      })
    })

    it('should parse name filter (name:value)', () => {
      const result = parseSearchQuery('name:Battery')
      expect(result.filters[0]).toMatchObject({
        type: 'name',
        value: 'Battery',
      })
    })

    it('should parse name filter with multiple words', () => {
      const result = parseSearchQuery('name:Lithium Ion Battery')
      expect(result.filters[0].value).toBe('Lithium Ion Battery')
    })

    it('should parse name filter with quotes', () => {
      const result = parseSearchQuery('name:"Clay Tile"')
      expect(result.filters[0].value).toBe('Clay Tile')
    })

    it('should parse createdBy filter', () => {
      const result = parseSearchQuery('createdBy:abc-123-def')
      expect(result.filters[0]).toMatchObject({
        type: 'createdBy',
        value: 'abc-123-def',
      })
    })

    it('should parse parent filter', () => {
      const result = parseSearchQuery('parent:parent-uuid-456')
      expect(result.filters[0]).toMatchObject({
        type: 'parent',
        value: 'parent-uuid-456',
      })
    })

    it('should parse combined filters and text', () => {
      const result = parseSearchQuery(
        'deleted:true prop:material=steel battery'
      )
      expect(result.searchTerm).toBe('battery')
      expect(result.filters.map((f) => f.type)).toEqual([
        'deleted',
        'property',
        'text',
      ])
    })

    it('should handle quoted strings in text search', () => {
      const result = parseSearchQuery('"heavy metal" scrap')
      expect(result.searchTerm).toBe('heavy metal scrap')
      expect(result.filters).toHaveLength(2)
      // The filter value includes quotes based on tokenizeQuery implementation
      expect(result.filters[0].value).toBe('"heavy metal"')
    })

    // The node drops a property with an empty key AND value, so it would return an unfiltered list.
    it.each(['prop:', 'value:', 'prop:  value:'])(
      'yields no property filter for a bare %j',
      (query) => {
        expect(parseSearchQuery(query).filters).toEqual([])
      }
    )

    it('should handle empty query', () => {
      const result = parseSearchQuery('')
      expect(result.searchTerm).toBe('')
      expect(result.filters).toEqual([])
    })
  })

  describe('toListParams', () => {
    it('sends no q for one letter, and keeps the filters beside it', () => {
      expect(paramsFor('a')).toEqual({})
      expect(paramsFor('deleted:true a')).toEqual({ deleted: 'only' })
      expect(paramsFor('ab')).toEqual({ q: 'ab' })
    })

    it.each([
      ['prop:material=steel', { property: ['material:steel'] }],
      ['prop:material', { property: ['material'] }],
      ['value:steel', { property: [':steel'] }],
      ['createdBy:abc-123', { createdBy: 'abc-123' }],
      ['deleted:true', { deleted: 'only' }],
      ['deleted:false', { deleted: 'exclude' }],
      [`parent:${PARENT}`, { parent: PARENT }],
      ['name:Clay Tile', { q: 'Clay Tile' }],
      ['name:"Clay Tile"', { q: 'Clay Tile' }],
      ['template:true', {}],
      ['battery', { q: 'battery' }],
      ['"heavy metal" scrap', { q: 'heavy metal scrap' }],
      ['', {}],
    ])('%j on objects → %j', (query, expected) => {
      expect(paramsFor(query)).toEqual(expected)
    })

    it('sends no q when every word has one letter', () => {
      expect(paramsFor('a b c')).toEqual({})
      expect(paramsFor('prop:material=steel a b')).toEqual({
        property: ['material:steel'],
      })
    })

    it('keeps 9 words as q, so the node refuses them where the user sees it', () => {
      const nine = 'a1 b2 c3 d4 e5 f6 g7 h8 i9'
      expect(paramsFor(`prop:material=steel ${nine}`)).toEqual({
        property: ['material:steel'],
        q: nine,
      })
    })

    it('sends one-letter words and 9 words on shares, which match one substring', () => {
      expect(paramsFor('a b c', 'shares')).toEqual({ q: 'a b c' })
      const nine = 'a1 b2 c3 d4 e5 f6 g7 h8 i9'
      expect(paramsFor(nine, 'shares')).toEqual({ q: nine })
    })

    it('sends the free text as q and every filter as its own param', () => {
      expect(paramsFor('prop:material=steel deleted:true beton')).toEqual({
        property: ['material:steel'],
        deleted: 'only',
        q: 'beton',
      })
    })

    it('ANDs several property filters as a list', () => {
      expect(paramsFor('prop:material=steel value:red prop:grade')).toEqual({
        property: ['material:steel', ':red', 'grade'],
      })
    })

    it('keeps a colon in a value, which the node splits off at the first colon', () => {
      expect(paramsFor('value:12:30')).toEqual({ property: [':12:30'] })
    })

    it('refuses a property key with a colon instead of sending another key', () => {
      const result = toListParams(
        parseSearchQuery('prop:a:b=c beton'),
        'objects'
      )
      expect(result.params).toEqual({ q: 'beton' })
      expect(result.invalid).toEqual([
        expect.objectContaining({ type: 'property', propertyKey: 'a:b' }),
      ])
    })

    it.each(['createdBy:', 'parent:'])(
      'reports an empty %s as invalid instead of dropping it',
      (query) => {
        const result = toListParams(parseSearchQuery(query), 'objects')
        expect(result.params).toEqual({})
        expect(result.invalid.map((f) => f.raw)).toEqual([query])
      }
    )

    it('leaves out a property filter on a list that does not take it', () => {
      for (const type of ['formulas', 'constants', 'shares'] as const) {
        const result = toListParams(
          parseSearchQuery('beton prop:material=steel value:red'),
          type
        )
        expect(result.params).toEqual({ q: 'beton' })
        expect(result.unsupported.map((f) => f.type)).toEqual([
          'property',
          'propertyValue',
        ])
      }
    })

    it('leaves out a parent filter everywhere but objects', () => {
      for (const type of ALL_TYPES.filter((t) => t !== 'objects')) {
        const result = toListParams(parseSearchQuery(`parent:${PARENT}`), type)
        expect(result.params).toEqual({})
        expect(result.unsupported).toEqual([
          expect.objectContaining({ type: 'parent' }),
        ])
      }
    })

    // The node ignores a param a list does not declare, so a stray one returns an unfiltered list.
    it.each([
      ['objects', ['q', 'property', 'createdBy', 'deleted', 'parent']],
      ['processes', ['q', 'property', 'createdBy', 'deleted']],
      ['templates', ['q', 'property', 'createdBy', 'deleted']],
      ['formulas', ['q', 'createdBy', 'deleted']],
      ['constants', ['q', 'createdBy', 'deleted']],
      ['shares', ['q', 'createdBy', 'deleted']],
    ] as const)('%s gets only the params it declares', (type, declared) => {
      const every = `prop:k=v value:x createdBy:u-1 deleted:true parent:${PARENT} name:N text`
      expect(Object.keys(paramsFor(every, type)).sort()).toEqual(
        [...declared].sort()
      )
    })
  })

  describe('listSearchQuery', () => {
    const search = (query: string) =>
      toListParams(parseSearchQuery(query), 'objects')

    it.each([
      ['no search, toggle off', null, false, undefined],
      ['no search, toggle on', null, true, 'include'],
      ['search without deleted:, toggle on', 'beton', true, 'include'],
      ['deleted:true, toggle off', 'deleted:true', false, 'only'],
      ['deleted:false, toggle on', 'deleted:false', true, 'exclude'],
    ] as const)('%s → deleted %j', (_case, query, showDeleted, deleted) => {
      const result = listSearchQuery(
        query === null ? null : search(query),
        showDeleted
      )
      expect(result.deleted).toBe(deleted)
    })

    it('carries the other search params through', () => {
      expect(
        listSearchQuery(search('prop:material=steel beton'), false)
      ).toEqual({
        property: ['material:steel'],
        q: 'beton',
        deleted: undefined,
      })
    })
  })

  describe('searchApplies', () => {
    it.each([
      ['no search', null, false],
      ['free text', 'beton', true],
      ['deleted:false alone', 'deleted:false', true],
      ['an invalid filter alone', 'prop:a:b=c', false],
    ] as const)('%s → %j', (_case, query, expected) => {
      expect(
        searchApplies(
          query === null
            ? null
            : toListParams(parseSearchQuery(query), 'objects')
        )
      ).toBe(expected)
    })

    it('is false for a filter the list does not take', () => {
      expect(
        searchApplies(
          toListParams(parseSearchQuery(`parent:${PARENT}`), 'formulas')
        )
      ).toBe(false)
    })
  })

  describe('searchKey', () => {
    const key = (query: string) =>
      searchKey(toListParams(parseSearchQuery(query), 'objects'))

    it('is equal for the same params from separate parses', () => {
      expect(key('beton prop:k=v')).toBe(key('beton prop:k=v'))
    })

    it('differs when the params differ, and for no search', () => {
      expect(key('beton')).not.toBe(key('steel'))
      expect(searchKey(null)).not.toBe(key('beton'))
    })
  })

  describe('templateSearch', () => {
    it.each([
      ['template:true', true],
      ['template:false', false],
      ['battery', undefined],
      ['template:false template:true', true],
    ])('%j → %j', (query, expected) => {
      expect(templateSearch(parseSearchQuery(query))).toBe(expected)
    })
  })

  describe('number, date and folder tokens', () => {
    const FOLDER = '0193a5c0-7d1e-7000-8000-000000000001'
    const NOV_1 = 1793487600000
    const NOV_2 = 1793574000000

    it.each([
      ['mass>2t', { numKey: 'mass', numGte: 2, numUnit: 't' }],
      ['mass<=5', { numKey: 'mass', numLte: 5 }],
      ['mass:2..5t', { numKey: 'mass', numGte: 2, numLte: 5, numUnit: 't' }],
      ['"total mass">2', { numKey: 'total mass', numGte: 2 }],
      ['created:2026-11-01', { createdFrom: NOV_1, createdTo: NOV_2 - 1 }],
      ['updated:..2026-11-01', { updatedTo: NOV_2 - 1 }],
      [`in:${FOLDER}`, { ancestor: FOLDER }],
      ['deleted:all', { deleted: 'include' }],
      ['beton mass>2', { q: 'beton', numKey: 'mass', numGte: 2 }],
      ['co2>5', { numKey: 'co2', numGte: 5 }],
      ['"co2>5"', { q: 'co2>5' }],
      ['a>b', { q: 'a>b' }],
      ['1:2', { q: '1:2' }],
      ['"name":2..5', { numKey: 'name', numGte: 2, numLte: 5 }],
    ])('%j on objects → %j', (query, expected) => {
      expect(paramsFor(query)).toEqual(expected)
    })

    it('stops an unquoted name: before a filter', () => {
      expect(paramsFor('name:Tile mass>2')).toEqual({
        q: 'Tile',
        numKey: 'mass',
        numGte: 2,
      })
      expect(paramsFor(`name:Clay tile in:${FOLDER}`)).toEqual({
        q: 'Clay tile',
        ancestor: FOLDER,
      })
    })

    it('reads name:2..5 as a name, since the prefix wins', () => {
      expect(paramsFor('name:2..5')).toEqual({ q: '2..5' })
    })

    const problems = (query: string, type: SearchListType = 'objects') =>
      toListParams(parseSearchQuery(query), type).invalid.map((f) => [
        f.raw,
        f.problem,
      ])

    it.each([
      ['mass > 2', [['mass > 2', 'spaces']]],
      ['mass> 2', [['mass> 2', 'spaces']]],
      ['mass >2', [['mass >2', 'spaces']]],
      ['mass:2', [['mass:2', 'equals']]],
      ['mass:5..2', [['mass:5..2', 'reversed']]],
      ['mass:2t..5t', [['mass:2t..5t', 'unitOnce']]],
      ['mass>1e3', [['mass>1e3', 'number']]],
      ['created:01-11-2026', [['created:01-11-2026', 'date']]],
      ['created:today', [['created:today', 'date']]],
      ['created:2026-02-30', [['created:2026-02-30', 'date']]],
      ['in:1..3', [['in:1..3', 'folder']]],
      ['mass>2 mass<5', [['mass<5', 'once']]],
      [
        'created:2026-11-01 created:2026-11-02',
        [['created:2026-11-02', 'once']],
      ],
      [`in:${FOLDER} parent:${PARENT}`, [[`in:${FOLDER}`, 'inAndParent']]],
    ])('%j is not applied, with its reason', (query, expected) => {
      expect(problems(query)).toEqual(expected)
    })

    it('sends nothing for a filter it cannot apply', () => {
      expect(paramsFor('mass:2 created:today')).toEqual({})
    })

    it('keeps the first of two number filters', () => {
      expect(paramsFor('mass>2 mass<5')).toEqual({ numKey: 'mass', numGte: 2 })
    })

    it.each(ALL_TYPES.filter((type) => type !== 'objects'))(
      'leaves numbers, dates and folders unapplied on %s',
      (type) => {
        const search = toListParams(
          parseSearchQuery(
            `mass>2 created:2026-11-01 updated:2026-11-01 in:${FOLDER} beton`
          ),
          type
        )
        expect(search.unsupported.map((f) => f.type)).toEqual([
          'number',
          'created',
          'updated',
          'folder',
        ])
        expect(search.params).toEqual({ q: 'beton' })
      }
    )

    it('strips the quotes from a property key and value', () => {
      expect(paramsFor('prop:"stainless steel"="grade a"')).toEqual({
        property: ['stainless steel:grade a'],
      })
      expect(paramsFor('prop:material="stainless steel"')).toEqual({
        property: ['material:stainless steel'],
      })
      expect(paramsFor('prop:"total mass"')).toEqual({
        property: ['total mass'],
      })
    })

    it.each([
      { key: 'name', op: 'range', gte: 2, lte: 5 },
      { key: 'created', op: '>=', gte: 1 },
      { key: 'total mass', op: '<=', lte: 5, unit: 't' },
    ] as const)(
      'writes a number filter on $key that the search reads back',
      (range) => {
        expect(paramsFor(numberToken(range))).toEqual({
          numKey: range.key,
          ...('gte' in range && { numGte: range.gte }),
          ...('lte' in range && { numLte: range.lte }),
          ...('unit' in range && { numUnit: range.unit }),
        })
      }
    )

    it('shows a number filter as ≥ or ≤, and reads that back the same', () => {
      const parsed = parseSearchQuery('mass>2t beton')
      const shown = filtersToDisplayString(parsed.filters)
      expect(shown).toBe('mass≥2t beton')
      expect(paramsFor(shown)).toEqual(paramsFor('mass>2t beton'))
    })
  })
})

describe('search-parser: what the node would refuse, or read another way', () => {
  const grammar = (decimalMark: '.' | ',' = '.') => ({
    units: unitKeys(['t', 'kg', 'g', 'km', 'm2', 'MJ', 'tonne']),
    decimalMark,
  })
  const problems = (query: string, decimalMark: '.' | ',' = '.') =>
    parseSearchQuery(query, grammar(decimalMark)).filters.map(
      (f) => f.problem ?? null
    )

  it.each(['temp>20°C', 'mass>2tons', 'mass:2..5xyz'])(
    'refuses %s: the node does not know the unit',
    (query) => {
      expect(problems(query)).toEqual(['unit'])
    }
  )

  it.each(['mass>2t', 'mass>=2T', 'mass:2..5kg', 'area<=3m2', 'mass>1tonne.'])(
    'takes %s: the node knows the unit, in any case',
    (query) => {
      expect(problems(query)).toEqual([null])
    }
  )

  it('takes any unit before the unit list has arrived: the node decides', () => {
    expect(
      parseSearchQuery('temp>20°C', { units: null, decimalMark: '.' })
        .filters[0].problem
    ).toBeUndefined()
  })

  it.each([
    ['mass>2 t', 'mass>2 t'],
    ['mass:2..5 kg', 'mass:2..5 kg'],
  ])('says "no spaces" for %s, and does not drop the unit', (query, raw) => {
    const [filter, ...rest] = parseSearchQuery(query, grammar()).filters
    expect(filter).toMatchObject({ problem: 'spaces', raw })
    expect(rest).toEqual([])
  })

  it('keeps a word after a number filter as text when it is no unit', () => {
    const result = parseSearchQuery('mass>2 steel', grammar())
    expect(result.filters.map((f) => f.type)).toEqual(['number', 'text'])
    expect(result.searchTerm).toBe('steel')
  })

  it.each(['pipe 2" steel mass>2t', '"steel mass>2t', 'steel" mass>2t'])(
    'reads the filters after an unmatched quote in %s',
    (query) => {
      const result = parseSearchQuery(query, grammar())
      expect(result.filters.filter((f) => f.type === 'number')).toEqual([
        expect.objectContaining({ value: 'mass>=2t' }),
      ])
    }
  )

  it('keeps a matched quote as one phrase', () => {
    const result = parseSearchQuery('"stainless steel" mass>2t', grammar())
    expect(result.searchTerm).toBe('stainless steel')
    expect(result.filters.map((f) => f.type)).toEqual(['text', 'number'])
  })

  it('shows a number pill with the decimal mark of the page', () => {
    const [filter] = parseSearchQuery('gewicht>1,5t', grammar(',')).filters
    expect(filter.label).toBe('gewicht≥1,5t')
    expect(filter.value).toBe('gewicht>=1.5t')
  })

  it('keeps the comma in the query when another pill is removed', () => {
    expect(
      queryWithout('gewicht>1,5t steel', (f) => f.type === 'text', grammar(','))
    ).toBe('gewicht≥1,5t')
  })

  it.each([
    ['mass>0,0000001 steel', 'mass≥0.0000001'],
    ['mass>1000000000000000000000 steel', 'mass≥1000000000000000000000'],
  ])(
    'keeps a very small or large number when another pill is removed: %s',
    (query, kept) => {
      const rewritten = queryWithout(query, (f) => f.type === 'text', grammar())
      expect(rewritten).toBe(kept)
      expect(problems(rewritten)).toEqual([null])
    }
  )

  it.each([
    ['value:stainless steel', 'stainless steel'],
    ['value:"stainless steel"', 'stainless steel'],
  ])('reads all the words of %s as the value', (query, value) => {
    const result = parseSearchQuery(query, grammar())
    expect(result.filters).toEqual([
      expect.objectContaining({ type: 'propertyValue', propertyValue: value }),
    ])
    expect(result.searchTerm).toBe('')
  })

  it('keeps prop:key=value one word: more words are text, quotes hold spaces', () => {
    const result = parseSearchQuery('prop:material=steel battery', grammar())
    expect(result.filters.map((f) => f.type)).toEqual(['property', 'text'])
    expect(result.searchTerm).toBe('battery')
  })

  it.each([
    ['prop:=steel', 'property'],
    ['deleted:yes', 'deleted'],
    ['template:maybe', 'template'],
    ['parent:abc', 'parent'],
  ])('says why %s cannot be applied', (query, problem) => {
    expect(problems(query)).toEqual([problem])
  })

  it('takes parent: with an object id', () => {
    expect(problems('parent:0192f1d2-7c3a-7b1e-9a4f-123456789abc')).toEqual([
      null,
    ])
  })
})

describe('parseSearchQuery reads numbers in the locale it is given', () => {
  it('marks 2.000 as a problem in a comma locale and sends no bound', () => {
    const parsed = parseSearchQuery('mass>=2.000kg', {
      units: null,
      decimalMark: ',',
    })
    expect(parsed.filters).toEqual([
      expect.objectContaining({ type: 'number', problem: 'grouping' }),
    ])
  })
})
