import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

import { usePropertyFormulas } from '@/components/properties/hooks/use-property-formulas'
import type { Property, FormulaData } from '@/components/properties/types'

const numericValueProp = (
  uuid: string,
  key: string,
  values: Array<{ uuid?: string; value: string }>
): Property => ({
  uuid,
  key,
  label: key,
  values,
})

describe('usePropertyFormulas', () => {
  describe('availablePropertiesFor', () => {
    it('returns sibling numeric values, excluding the requesting property', () => {
      const properties: Property[] = [
        numericValueProp('p1', 'mass', [{ uuid: 'v1', value: '10' }]),
        numericValueProp('p2', 'volume', [{ uuid: 'v2', value: '5' }]),
      ]
      const { result } = renderHook(() =>
        usePropertyFormulas(properties, properties)
      )

      const siblings = result.current.availablePropertiesFor('p1')
      expect(siblings).toHaveLength(1)
      expect(siblings[0].key).toBe('volume')
    })

    it('skips non-numeric values and rows still flagged needsInput', () => {
      const properties: Property[] = [
        numericValueProp('p1', 'note', [{ uuid: 'v1', value: 'hello' }]),
        {
          uuid: 'p2',
          key: 'pending',
          values: [{ value: '5', _needsInput: true }],
        },
        numericValueProp('p3', 'mass', [{ uuid: 'v3', value: '42' }]),
      ]
      const { result } = renderHook(() =>
        usePropertyFormulas(properties, properties)
      )

      const siblings = result.current.availablePropertiesFor('p1')
      expect(siblings.map((s) => s.key)).toEqual(['mass'])
    })

    it('returns an empty array for an unknown property id', () => {
      const properties: Property[] = [
        numericValueProp('p1', 'mass', [{ uuid: 'v1', value: '10' }]),
      ]
      const { result } = renderHook(() =>
        usePropertyFormulas(properties, properties)
      )

      expect(result.current.availablePropertiesFor('nope')).toEqual([])
    })
  })

  describe('resolveCompositeIdToValueUUID', () => {
    it('resolves a real value uuid for a known property/index', () => {
      const properties: Property[] = [
        numericValueProp('p1', 'mass', [
          { uuid: 'v1a', value: '10' },
          { uuid: 'v1b', value: '20' },
        ]),
      ]
      const { result } = renderHook(() =>
        usePropertyFormulas(properties, properties)
      )

      expect(result.current.resolveCompositeIdToValueUUID('p1::1')).toBe('v1b')
    })

    it('returns null for malformed composite ids and missing properties', () => {
      const { result } = renderHook(() => usePropertyFormulas([], []))
      expect(result.current.resolveCompositeIdToValueUUID('not-a-id')).toBe(
        null
      )
      expect(result.current.resolveCompositeIdToValueUUID('missing::0')).toBe(
        null
      )
    })
  })

  describe('buildFormulaArgs', () => {
    it('builds args for resolved variables and lists unresolved by name', () => {
      const { result } = renderHook(() => usePropertyFormulas([], []))
      const formula = {
        formulaUuid: 'f1',
        variableMapping: {
          a: { propertyUuid: 'p1::0' },
          b: { propertyUuid: 'p2::0' },
        },
      } as unknown as FormulaData

      const resolve = (id: string) => (id === 'p1::0' ? 'real-uuid-a' : null)
      const { args, unresolved } = result.current.buildFormulaArgs(
        formula,
        resolve
      )
      expect(args).toEqual([{ name: 'a', propertyValueUUID: 'real-uuid-a' }])
      expect(unresolved).toEqual(['b'])
    })
  })
})
