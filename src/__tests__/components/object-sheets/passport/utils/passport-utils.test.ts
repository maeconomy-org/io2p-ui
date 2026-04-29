import { describe, it, expect } from 'vitest'

import {
  computeDateProgress,
  findValueByKey,
  flattenValues,
  groupPropertiesByCategory,
  isImageFile,
  parseDateValue,
} from '@/components/object-sheets/passport/utils/passport-utils'

describe('passport-utils', () => {
  describe('flattenValues', () => {
    it('joins multiple non-empty values with a comma', () => {
      expect(
        flattenValues({
          values: [{ value: 'Steel' }, { value: 'Polymer' }, { value: '' }],
        })
      ).toBe('Steel, Polymer')
    })

    it('returns empty string when no values are present', () => {
      expect(flattenValues({ values: [] })).toBe('')
      expect(flattenValues({})).toBe('')
    })

    it('coerces non-string values', () => {
      expect(flattenValues({ values: [{ value: 42 }, { value: 3.14 }] })).toBe(
        '42, 3.14'
      )
    })
  })

  describe('findValueByKey', () => {
    const props = [
      { key: 'manufacturer', values: [{ value: 'Acme' }] },
      { key: 'weight', values: [{ value: '1240 kg' }] },
    ]
    it('returns the flattened value when the key matches', () => {
      expect(findValueByKey(props, 'manufacturer')).toBe('Acme')
    })
    it('returns empty string for a missing key', () => {
      expect(findValueByKey(props, 'unknown-key')).toBe('')
    })
  })

  describe('groupPropertiesByCategory', () => {
    it('buckets known dictionary keys into the right category and skips empties', () => {
      const groups = groupPropertiesByCategory([
        { key: 'manufacturer', values: [{ value: 'Acme' }] },
        { key: 'weight', values: [{ value: '10' }] },
        { key: 'height', values: [{ value: '' }] }, // empty -> dropped
        { key: 'co2-equivalent', values: [{ value: '500' }] },
      ])
      const map = Object.fromEntries(
        groups.map((g) => [g.category, g.entries.map((e) => e.property.key)])
      )
      expect(map.product).toEqual(['manufacturer'])
      expect(map.dimensions).toEqual(['weight'])
      expect(map.sustainability).toEqual(['co2-equivalent'])
    })

    it('excludes lifecycle keys (they are surfaced by the ribbon, not the cards)', () => {
      const groups = groupPropertiesByCategory([
        { key: 'production-date', values: [{ value: '2020-01-01' }] },
        { key: 'warranty-end', values: [{ value: '2030-01-01' }] },
        { key: 'manufacturer', values: [{ value: 'Acme' }] },
      ])
      const allKeys = groups.flatMap((g) =>
        g.entries.map((e) => e.property.key)
      )
      expect(allKeys).toEqual(['manufacturer'])
    })

    it('routes free-text properties into the "other" bucket', () => {
      const groups = groupPropertiesByCategory([
        { key: 'custom-thing', values: [{ value: '123' }] },
      ])
      expect(groups).toHaveLength(1)
      expect(groups[0].category).toBe('other')
    })
  })

  describe('parseDateValue', () => {
    it('parses ISO dates', () => {
      const d = parseDateValue('2024-06-01')
      expect(d).not.toBeNull()
      expect(d!.getUTCFullYear()).toBe(2024)
    })

    it('returns null for empty / unparseable input', () => {
      expect(parseDateValue('')).toBeNull()
      expect(parseDateValue('   ')).toBeNull()
      expect(parseDateValue('not a date')).toBeNull()
      expect(parseDateValue(null)).toBeNull()
    })
  })

  describe('computeDateProgress', () => {
    it('returns ~50% when today is the midpoint of the range', () => {
      const from = new Date('2020-01-01')
      const to = new Date('2030-01-01')
      const now = new Date('2025-01-01')
      const result = computeDateProgress(from, to, now)
      expect(result).not.toBeNull()
      // Allow a small fudge — leap-year + day boundaries shift the percent
      // by at most ~1 percentage point.
      expect(result!.percent).toBeGreaterThanOrEqual(49)
      expect(result!.percent).toBeLessThanOrEqual(51)
      expect(result!.isOverdue).toBe(false)
    })

    it('flags overdue when today is past the end date', () => {
      const result = computeDateProgress(
        new Date('2010-01-01'),
        new Date('2015-01-01'),
        new Date('2025-01-01')
      )
      expect(result!.isOverdue).toBe(true)
      expect(result!.percent).toBe(100)
      expect(result!.daysRemaining).toBeLessThan(0)
    })

    it('returns null when from/to are missing or inverted', () => {
      expect(computeDateProgress(null, new Date(), new Date())).toBeNull()
      expect(computeDateProgress(new Date(), null, new Date())).toBeNull()
      expect(
        computeDateProgress(
          new Date('2030-01-01'),
          new Date('2020-01-01'),
          new Date()
        )
      ).toBeNull()
    })
  })

  describe('isImageFile', () => {
    it('returns true for image MIME types', () => {
      expect(isImageFile({ contentType: 'image/png' })).toBe(true)
      expect(isImageFile({ contentType: 'image/jpeg' })).toBe(true)
    })
    it('returns false for non-image or missing MIME types', () => {
      expect(isImageFile({ contentType: 'application/pdf' })).toBe(false)
      expect(isImageFile({})).toBe(false)
      expect(isImageFile(undefined)).toBe(false)
    })
  })
})
