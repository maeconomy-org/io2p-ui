import { describe, it, expect } from 'vitest'
import {
  DIMENSIONS,
  UNIT_ALIASES,
  normalizeUnit,
  dimensionOf,
  toCanonical,
} from '@/lib/units/unit-registry'

describe('unit-registry', () => {
  describe('DIMENSIONS integrity', () => {
    it('every dimension has its canonical unit at factor 1', () => {
      for (const [name, dim] of Object.entries(DIMENSIONS)) {
        expect(
          dim.units[dim.canonical as keyof typeof dim.units],
          `${name}.canonical (${dim.canonical}) must exist with factor 1`
        ).toBe(1)
      }
    })

    it('every alias target resolves to a real symbol in some dimension', () => {
      const allSymbols = new Set(
        Object.values(DIMENSIONS).flatMap((d) => Object.keys(d.units))
      )
      for (const target of Object.values(UNIT_ALIASES)) {
        expect(allSymbols.has(target), `alias target ${target}`).toBe(true)
      }
    })
  })

  describe('normalizeUnit', () => {
    it('resolves canonical symbols directly', () => {
      expect(normalizeUnit('kg')).toBe('kg')
      expect(normalizeUnit('mm')).toBe('mm')
    })

    it('is case-insensitive and trims', () => {
      expect(normalizeUnit('  KG ')).toBe('kg')
      expect(normalizeUnit('Tonnes')).toBe('t')
    })

    it('resolves spelled-out and plural aliases', () => {
      expect(normalizeUnit('kilograms')).toBe('kg')
      expect(normalizeUnit('tons')).toBe('t')
      expect(normalizeUnit('pieces')).toBe('pcs')
      expect(normalizeUnit('meters')).toBe('m')
    })

    it('normalizes superscript ³/² to 3/2', () => {
      expect(normalizeUnit('m³')).toBe('m3')
      expect(normalizeUnit('m²')).toBe('m2')
    })

    it('returns null for unknown or empty units', () => {
      expect(normalizeUnit('widgets')).toBeNull()
      expect(normalizeUnit('')).toBeNull()
      expect(normalizeUnit(null)).toBeNull()
      expect(normalizeUnit(undefined)).toBeNull()
    })
  })

  describe('dimensionOf', () => {
    it('maps units to their dimension', () => {
      expect(dimensionOf('t')).toBe('mass')
      expect(dimensionOf('cm')).toBe('length')
      expect(dimensionOf('pcs')).toBe('count')
      expect(dimensionOf('m3')).toBe('volume')
    })

    it('returns null for unknown units', () => {
      expect(dimensionOf('widgets')).toBeNull()
    })
  })

  describe('toCanonical', () => {
    it('converts within the mass dimension to kg', () => {
      expect(toCanonical(0.1, 't')).toEqual({ value: 100, unit: 'kg' })
      expect(toCanonical(100, 'kg')).toEqual({ value: 100, unit: 'kg' })
      expect(toCanonical(500, 'g')).toEqual({ value: 0.5, unit: 'kg' })
    })

    it('converts length to mm', () => {
      expect(toCanonical(1, 'm')).toEqual({ value: 1000, unit: 'mm' })
      expect(toCanonical(2.54, 'cm')).toEqual({ value: 25.4, unit: 'mm' })
    })

    it('keeps count as pcs', () => {
      expect(toCanonical(3, 'pcs')).toEqual({ value: 3, unit: 'pcs' })
    })

    it('returns null for unknown units (caller decides fallback)', () => {
      expect(toCanonical(5, 'widgets')).toBeNull()
      expect(toCanonical(5, null)).toBeNull()
    })

    it('round-trips an aliased unit', () => {
      expect(toCanonical(1, 'Tonne')).toEqual({ value: 1000, unit: 'kg' })
    })
  })
})
