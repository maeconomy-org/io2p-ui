import { describe, it, expect } from 'vitest'

import {
  createEmptyProperty,
  extractUserUUID,
  findModelForObject,
  formatSoftDeleteBy,
  getObjectDisplayName,
  getObjectTimestamps,
  getSoftDeleteInfo,
  isObjectDeleted,
} from '@/components/object-sheets/utils/object-utils'

describe('object-utils', () => {
  describe('findModelForObject', () => {
    it('returns null when object has no modelUuid', () => {
      expect(findModelForObject({}, [{ uuid: 'm1' }])).toEqual({
        model: null,
        hasModel: false,
      })
    })

    it('returns null when availableModels is empty', () => {
      expect(findModelForObject({ modelUuid: 'm1' }, [])).toEqual({
        model: null,
        hasModel: false,
      })
    })

    it('returns the matching model when found', () => {
      const model = { uuid: 'm1', name: 'Model 1' }
      expect(
        findModelForObject({ modelUuid: 'm1' }, [model, { uuid: 'm2' }])
      ).toEqual({
        model,
        hasModel: true,
      })
    })

    it('returns null when modelUuid does not match any model', () => {
      expect(findModelForObject({ modelUuid: 'm1' }, [{ uuid: 'm2' }])).toEqual(
        { model: null, hasModel: false }
      )
    })
  })

  describe('createEmptyProperty', () => {
    it('returns a property with empty key, one empty value, and a unique _tempId', () => {
      const a = createEmptyProperty()
      const b = createEmptyProperty()

      expect(a.uuid).toBe('')
      expect(a.key).toBe('')
      expect(a.label).toBe('')
      expect(a.values).toHaveLength(1)
      expect(a.values[0]).toMatchObject({ uuid: '', value: '', formula: '' })
      expect(a.files).toEqual([])

      expect(a._tempId).not.toBe(b._tempId)
      expect(a._tempId).toMatch(/^new-\d+$/)
    })
  })

  describe('isObjectDeleted', () => {
    it('returns true when softDeleted is truthy', () => {
      expect(isObjectDeleted({ softDeleted: true })).toBe(true)
    })

    it('returns true when isDeleted is truthy', () => {
      expect(isObjectDeleted({ isDeleted: 1 })).toBe(true)
    })

    it('returns false for clean objects and null/undefined', () => {
      expect(isObjectDeleted({})).toBe(false)
      expect(isObjectDeleted(null)).toBe(false)
      expect(isObjectDeleted(undefined)).toBe(false)
    })
  })

  describe('getObjectDisplayName', () => {
    it('prefers name, then uuid, then fallbacks', () => {
      expect(getObjectDisplayName({ name: 'A', uuid: 'u' })).toBe('A')
      expect(getObjectDisplayName({ uuid: 'u' })).toBe('u')
      expect(getObjectDisplayName({})).toBe('Unnamed Object')
      expect(getObjectDisplayName(null)).toBe('Unknown Object')
    })
  })

  describe('getObjectTimestamps', () => {
    it('formats both timestamps when present', () => {
      const iso = '2026-01-01T00:00:00Z'
      const { created, updated } = getObjectTimestamps({
        createdAt: iso,
        lastUpdatedAt: iso,
      })
      expect(created).toBeTruthy()
      expect(updated).toBeTruthy()
    })

    it('returns null fields when timestamps are absent', () => {
      expect(getObjectTimestamps({})).toEqual({ created: null, updated: null })
    })
  })

  describe('getSoftDeleteInfo', () => {
    it('returns null when object is not deleted', () => {
      expect(getSoftDeleteInfo({})).toBeNull()
    })

    it('returns formatted deletedAt + deletedBy when available', () => {
      const info = getSoftDeleteInfo({
        softDeleted: true,
        softDeletedAt: '2026-01-01T00:00:00Z',
        softDeleteBy: { userUUID: 'user-1' },
      })
      expect(info?.deletedBy).toBe('user-1')
      expect(info?.deletedAt).toBeTruthy()
    })

    it('handles missing softDeletedAt and missing user', () => {
      const info = getSoftDeleteInfo({ softDeleted: true })
      expect(info).toEqual({ deletedAt: null, deletedBy: null })
    })
  })

  describe('extractUserUUID', () => {
    it('returns string input directly', () => {
      expect(extractUserUUID('abc')).toBe('abc')
    })

    it('returns userUUID or uuid field from an object', () => {
      expect(extractUserUUID({ userUUID: 'u1' })).toBe('u1')
      expect(extractUserUUID({ uuid: 'u2' })).toBe('u2')
      expect(extractUserUUID({ userUUID: 'u1', uuid: 'u2' })).toBe('u1')
    })

    it('returns null for null/undefined or objects without matching fields', () => {
      expect(extractUserUUID(null)).toBeNull()
      expect(extractUserUUID(undefined)).toBeNull()
      expect(extractUserUUID({})).toBeNull()
    })
  })

  describe('formatSoftDeleteBy', () => {
    it('returns the input unchanged when under maxLength', () => {
      expect(formatSoftDeleteBy('short', 10)).toBe('short')
    })

    it('truncates from the start with an ellipsis prefix when too long', () => {
      const value = 'a'.repeat(50)
      const out = formatSoftDeleteBy(value, 10)
      expect(out.startsWith('...')).toBe(true)
      expect(out.length).toBe(13)
    })

    it('returns empty string for falsy input', () => {
      expect(formatSoftDeleteBy('')).toBe('')
    })
  })
})
