import { describe, it, expect } from 'vitest'
import { parseSearchQuery } from '@/lib/search-parser'

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
      expect(result.searchBy).toEqual({})
    })

    it('should parse multiple text parts', () => {
      const result = parseSearchQuery('lithium ion battery')
      expect(result.searchTerm).toBe('lithium ion battery')
      expect(result.filters).toHaveLength(3)
      expect(result.searchBy).toEqual({})
    })

    it('should parse deleted:true filter', () => {
      const result = parseSearchQuery('deleted:true battery')
      expect(result.searchTerm).toBe('battery')
      expect(result.searchBy.softDeleted).toBe(true)
      expect(result.filters).toContainEqual(
        expect.objectContaining({
          type: 'deleted',
          value: 'true',
        })
      )
    })

    it('should parse deleted:false filter', () => {
      const result = parseSearchQuery('deleted:false')
      expect(result.searchBy.softDeleted).toBe(false)
      expect(result.filters[0].type).toBe('deleted')
    })

    it('should parse template filter', () => {
      const result = parseSearchQuery('template:true')
      expect(result.searchBy.isTemplate).toBe(true)
      expect(result.filters[0].type).toBe('template')
    })

    it('should parse property label filter (prop:label)', () => {
      const result = parseSearchQuery('prop:material')
      expect(result.searchBy['properties.label']).toBe('material')
      expect(result.searchBy['properties.values.value']).toBeUndefined()
      expect(result.filters[0]).toMatchObject({
        type: 'propertyLabel',
        propertyKey: 'material',
      })
    })

    it('should parse property label and value (prop:label=value)', () => {
      const result = parseSearchQuery('prop:material=steel')
      expect(result.searchBy['properties.label']).toBe('material')
      expect(result.searchBy['properties.values.value']).toBe('steel')
      expect(result.filters[0]).toMatchObject({
        type: 'property',
        propertyKey: 'material',
        propertyValue: 'steel',
      })
    })

    it('should parse property value only (value:xyz)', () => {
      const result = parseSearchQuery('value:active')
      expect(result.searchBy['properties.values.value']).toBe('active')
      expect(result.filters[0]).toMatchObject({
        type: 'propertyValue',
        propertyValue: 'active',
      })
    })

    it('should parse name filter (name:value)', () => {
      const result = parseSearchQuery('name:Battery')
      expect(result.searchBy.name).toBe('Battery')
      expect(result.filters[0].type).toBe('name')
    })

    it('should parse name filter with multiple words', () => {
      const result = parseSearchQuery('name:Lithium Ion Battery')
      expect(result.searchBy.name).toBe('Lithium Ion Battery')
      expect(result.filters[0].value).toBe('Lithium Ion Battery')
    })

    it('should parse name filter with quotes', () => {
      const result = parseSearchQuery('name:"Clay Tile"')
      expect(result.searchBy.name).toBe('Clay Tile')
    })

    it('should parse createdBy filter', () => {
      const uuid = 'abc-123-def'
      const result = parseSearchQuery(`createdBy:${uuid}`)
      expect(result.searchBy.createdByUserUUID).toBe(uuid)
    })

    it('should parse parent filter', () => {
      const uuid = 'parent-uuid-456'
      const result = parseSearchQuery(`parent:${uuid}`)
      expect(result.searchBy.parentUUID).toBe(uuid)
    })

    it('should parse combined filters and text', () => {
      const result = parseSearchQuery(
        'deleted:true prop:material=steel battery'
      )
      expect(result.searchTerm).toBe('battery')
      expect(result.searchBy.softDeleted).toBe(true)
      expect(result.searchBy['properties.label']).toBe('material')
      expect(result.searchBy['properties.values.value']).toBe('steel')
      expect(result.filters).toHaveLength(3)
    })

    it('should handle quoted strings in text search', () => {
      const result = parseSearchQuery('"heavy metal" scrap')
      expect(result.searchTerm).toBe('heavy metal scrap')
      expect(result.filters).toHaveLength(2)
      // The filter value includes quotes based on tokenizeQuery implementation
      expect(result.filters[0].value).toBe('"heavy metal"')
    })

    it('should handle empty query', () => {
      const result = parseSearchQuery('')
      expect(result.searchTerm).toBe('')
      expect(result.filters).toEqual([])
      expect(result.searchBy).toEqual({})
    })
  })
})
