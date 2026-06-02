import { describe, it, expect } from 'vitest'
import {
  parseQuantity,
  hasNumericValue,
  hasKnownUnit,
} from '@/lib/units/parse-quantity'

describe('parse-quantity', () => {
  describe('parseQuantity', () => {
    it('parses number + known unit and canonicalizes', () => {
      expect(parseQuantity('100 kg')).toEqual({
        raw: '100 kg',
        value: 100,
        unit: 'kg',
        canonicalUnit: 'kg',
        canonicalValue: 100,
      })
    })

    it('converts to canonical when the unit differs', () => {
      expect(parseQuantity('0.1 t')).toEqual({
        raw: '0.1 t',
        value: 0.1,
        unit: 't',
        canonicalUnit: 'kg',
        canonicalValue: 100,
      })
    })

    it('handles a bare number (no unit)', () => {
      expect(parseQuantity('100')).toEqual({
        raw: '100',
        value: 100,
        unit: null,
        canonicalUnit: null,
        canonicalValue: 100,
      })
    })

    it('keeps the number for an unknown unit, canonicalUnit stays null', () => {
      expect(parseQuantity('5 widgets')).toEqual({
        raw: '5 widgets',
        value: 5,
        unit: 'widgets',
        canonicalUnit: null,
        canonicalValue: 5,
      })
    })

    it('parses with no space between number and unit', () => {
      const r = parseQuantity('100kg')
      expect(r.value).toBe(100)
      expect(r.unit).toBe('kg')
      expect(r.canonicalValue).toBe(100)
    })

    it('accepts a comma decimal separator', () => {
      const r = parseQuantity('0,1 t')
      expect(r.value).toBeCloseTo(0.1)
      expect(r.canonicalValue).toBeCloseTo(100)
    })

    it('accepts decimals with a leading dot and negative sign', () => {
      expect(parseQuantity('.5 m').value).toBe(0.5)
      expect(parseQuantity('-2 kg').value).toBe(-2)
    })

    it('returns nulls for non-numeric / empty input', () => {
      for (const raw of ['n/a', 'abc', '', '   ']) {
        expect(parseQuantity(raw)).toMatchObject({
          value: null,
          unit: null,
          canonicalUnit: null,
          canonicalValue: null,
        })
      }
    })

    it('preserves the raw string verbatim', () => {
      expect(parseQuantity('  100  Tonnes ').raw).toBe('  100  Tonnes ')
    })

    it('handles null/undefined input', () => {
      expect(parseQuantity(null).value).toBeNull()
      expect(parseQuantity(undefined).value).toBeNull()
    })
  })

  describe('hasNumericValue', () => {
    it('is true only when a leading number is present', () => {
      expect(hasNumericValue('100 kg')).toBe(true)
      expect(hasNumericValue('100')).toBe(true)
      expect(hasNumericValue('abc')).toBe(false)
      expect(hasNumericValue('')).toBe(false)
    })
  })

  describe('hasKnownUnit', () => {
    it('is true for recognized units, false otherwise', () => {
      expect(hasKnownUnit('100 kg')).toBe(true)
      expect(hasKnownUnit('5 widgets')).toBe(false)
      expect(hasKnownUnit('100')).toBe(false)
    })
  })
})
