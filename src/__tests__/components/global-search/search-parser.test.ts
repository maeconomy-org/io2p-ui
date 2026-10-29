import { describe, it, expect } from 'vitest'
import {
  listSearchQuery,
  parseSearchQuery,
  searchApplies,
  templateSearch,
  toListParams,
  type SearchListType,
} from '@/components/global-search/search-parser'

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
    it.each([
      ['prop:material=steel', { property: ['material:steel'] }],
      ['prop:material', { property: ['material'] }],
      ['value:steel', { property: [':steel'] }],
      ['createdBy:abc-123', { createdBy: 'abc-123' }],
      ['deleted:true', { deleted: 'only' }],
      ['deleted:false', { deleted: 'exclude' }],
      ['parent:p-1', { parent: 'p-1' }],
      ['name:Clay Tile', { q: 'Clay Tile' }],
      ['name:"Clay Tile"', { q: 'Clay Tile' }],
      ['template:true', {}],
      ['battery', { q: 'battery' }],
      ['"heavy metal" scrap', { q: 'heavy metal scrap' }],
      ['', {}],
    ])('%j on objects → %j', (query, expected) => {
      expect(paramsFor(query)).toEqual(expected)
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
          parseSearchQuery('prop:material=steel value:red beton'),
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
        const result = toListParams(parseSearchQuery('parent:p-1'), type)
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
      const every =
        'prop:k=v value:x createdBy:u-1 deleted:true parent:p-1 name:N text'
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
        searchApplies(toListParams(parseSearchQuery('parent:p-1'), 'formulas'))
      ).toBe(false)
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
})
