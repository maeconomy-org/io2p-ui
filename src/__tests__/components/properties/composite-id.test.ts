import { describe, it, expect } from 'vitest'

import {
  makeCompositeId,
  parseCompositeId,
  isOwnCompositeId,
  makeIndexCompositeId,
} from '@/components/properties/utils/composite-id'

describe('composite-id utilities', () => {
  describe('makeCompositeId', () => {
    it('creates a composite ID from property ID and value index', () => {
      expect(makeCompositeId('prop-uuid-123', 0)).toBe('prop-uuid-123::0')
      expect(makeCompositeId('prop-uuid-123', 2)).toBe('prop-uuid-123::2')
    })

    it('works with index-based property IDs', () => {
      expect(makeCompositeId('prop-0', 1)).toBe('prop-0::1')
    })

    it('works with UUID-based property IDs', () => {
      expect(makeCompositeId('550e8400-e29b-41d4-a716-446655440000', 0)).toBe(
        '550e8400-e29b-41d4-a716-446655440000::0'
      )
    })
  })

  describe('makeIndexCompositeId', () => {
    it('creates index-based composite IDs for creation flow', () => {
      expect(makeIndexCompositeId(0, 0)).toBe('prop-0::0')
      expect(makeIndexCompositeId(2, 1)).toBe('prop-2::1')
      expect(makeIndexCompositeId(10, 3)).toBe('prop-10::3')
    })
  })

  describe('parseCompositeId', () => {
    it('parses a valid composite ID', () => {
      const result = parseCompositeId('prop-uuid-123::0')
      expect(result).toEqual({ propertyId: 'prop-uuid-123', valueIndex: 0 })
    })

    it('parses index-based composite IDs', () => {
      const result = parseCompositeId('prop-0::1')
      expect(result).toEqual({ propertyId: 'prop-0', valueIndex: 1 })
    })

    it('parses UUID-based composite IDs', () => {
      const result = parseCompositeId('550e8400-e29b-41d4-a716-446655440000::2')
      expect(result).toEqual({
        propertyId: '550e8400-e29b-41d4-a716-446655440000',
        valueIndex: 2,
      })
    })

    it('returns null for strings without separator', () => {
      expect(parseCompositeId('prop-uuid-123')).toBeNull()
      expect(parseCompositeId('no-separator')).toBeNull()
    })

    it('returns null for empty property ID', () => {
      expect(parseCompositeId('::0')).toBeNull()
    })

    it('returns null for non-numeric value index', () => {
      expect(parseCompositeId('prop-0::abc')).toBeNull()
    })

    it('returns null for negative value index', () => {
      expect(parseCompositeId('prop-0::-1')).toBeNull()
    })

    it('uses last separator when multiple exist', () => {
      // UUID contains colons — uses lastIndexOf
      const result = parseCompositeId('a::b::2')
      expect(result).toEqual({ propertyId: 'a::b', valueIndex: 2 })
    })
  })

  describe('isOwnCompositeId', () => {
    it('returns true for matching property ID', () => {
      expect(isOwnCompositeId('prop-0::0', 'prop-0')).toBe(true)
      expect(isOwnCompositeId('prop-0::1', 'prop-0')).toBe(true)
    })

    it('returns false for different property ID', () => {
      expect(isOwnCompositeId('prop-1::0', 'prop-0')).toBe(false)
    })

    it('works with UUID-based IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      expect(isOwnCompositeId(`${uuid}::0`, uuid)).toBe(true)
      expect(isOwnCompositeId(`${uuid}::3`, uuid)).toBe(true)
      expect(isOwnCompositeId('other-uuid::0', uuid)).toBe(false)
    })

    it('does not match partial prefixes', () => {
      // prop-0 should not match prop-00
      expect(isOwnCompositeId('prop-00::0', 'prop-0')).toBe(false)
    })
  })
})
