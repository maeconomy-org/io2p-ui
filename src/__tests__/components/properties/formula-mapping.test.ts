import { describe, it, expect, vi } from 'vitest'

import {
  generateTempUUID,
  buildTempUUIDMap,
  mapFormulaToAggregatePayload,
  mapAggregateResponseToFormulaData,
  mapFormulaToStandaloneCalc,
} from '@/components/properties/utils/formula-mapping'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000001'),
})

describe('formula-mapping utilities', () => {
  describe('generateTempUUID', () => {
    it('returns a string UUID', () => {
      const uuid = generateTempUUID()
      expect(typeof uuid).toBe('string')
      expect(uuid).toBeTruthy()
    })
  })

  describe('buildTempUUIDMap', () => {
    it('creates composite IDs for all property values', () => {
      const properties = [
        { key: 'length', values: [{ value: '10' }, { value: '20' }] },
        { key: 'width', values: [{ value: '5' }] },
      ]

      const map = buildTempUUIDMap(properties)

      expect(map.size).toBe(3)
      expect(map.has('prop-0::0')).toBe(true)
      expect(map.has('prop-0::1')).toBe(true)
      expect(map.has('prop-1::0')).toBe(true)
    })

    it('returns empty map for empty properties', () => {
      const map = buildTempUUIDMap([])
      expect(map.size).toBe(0)
    })

    it('handles properties with no values', () => {
      const properties = [{ key: 'empty' }]
      const map = buildTempUUIDMap(properties)
      expect(map.size).toBe(0)
    })
  })

  describe('mapFormulaToAggregatePayload', () => {
    it('returns null when no formulaUuid', () => {
      const result = mapFormulaToAggregatePayload({}, new Map(), 0, 0)
      expect(result).toBeNull()
    })

    it('returns null when no args can be resolved', () => {
      const formulaData = {
        formulaUuid: 'formula-1',
        variableMapping: {
          x: { propertyKey: 'length', propertyUuid: 'prop-99::0' },
        },
      }
      const tempMap = new Map([['prop-0::0', 'temp-uuid-1']])

      const result = mapFormulaToAggregatePayload(formulaData, tempMap, 0, 0)
      expect(result).toBeNull()
    })

    it('creates valid aggregate payload with args and result', () => {
      const formulaData = {
        formulaUuid: 'formula-1',
        variableMapping: {
          x: { propertyKey: 'length', propertyUuid: 'prop-0::0' },
          y: { propertyKey: 'width', propertyUuid: 'prop-1::0' },
        },
      }
      const tempMap = new Map([
        ['prop-0::0', 'temp-uuid-a'],
        ['prop-1::0', 'temp-uuid-b'],
        ['prop-2::0', 'temp-uuid-result'],
      ])

      const result = mapFormulaToAggregatePayload(formulaData, tempMap, 2, 0)

      expect(result).not.toBeNull()
      expect(result!.uuid).toBe('formula-1')
      expect(result!.mathFormulaCalc.args).toHaveLength(2)
      expect(result!.mathFormulaCalc.args).toEqual(
        expect.arrayContaining([
          { name: 'x', propertyValueUUID: 'temp-uuid-a' },
          { name: 'y', propertyValueUUID: 'temp-uuid-b' },
        ])
      )
      expect(result!.mathFormulaCalc.result.propertyValueUUID).toBe(
        'temp-uuid-result'
      )
    })
  })

  describe('mapAggregateResponseToFormulaData', () => {
    it('returns null when no mathFormulaCalc', () => {
      const result = mapAggregateResponseToFormulaData(
        { uuid: 'f1' } as any,
        { properties: [] } as any
      )
      expect(result).toBeNull()
    })

    it('reconstructs formulaData from aggregate response', () => {
      const mathFormula = {
        uuid: 'formula-1',
        name: 'Area',
        expression: 'x * y',
        mathFormulaCalc: {
          uuid: 'calc-1',
          args: [
            { name: 'x', propertyValueUUID: 'pv-uuid-1' },
            { name: 'y', propertyValueUUID: 'pv-uuid-2' },
          ],
          result: { propertyValueUUID: 'pv-uuid-3' },
        },
      }

      const entity = {
        properties: [
          {
            key: 'length',
            values: [{ uuid: 'pv-uuid-1', value: '10' }],
          },
          {
            key: 'width',
            values: [{ uuid: 'pv-uuid-2', value: '5' }],
          },
          {
            key: 'area',
            values: [{ uuid: 'pv-uuid-3', value: '50' }],
          },
        ],
      }

      const result = mapAggregateResponseToFormulaData(
        mathFormula as any,
        entity as any
      )

      expect(result).not.toBeNull()
      expect(result.formulaUuid).toBe('formula-1')
      expect(result.formulaName).toBe('Area')
      expect(result.formula).toBe('x * y')
      expect(result.variableMapping).toEqual({
        x: { propertyKey: 'length', propertyUuid: 'prop-0::0' },
        y: { propertyKey: 'width', propertyUuid: 'prop-1::0' },
      })
    })
  })

  describe('mapFormulaToStandaloneCalc', () => {
    const entity = {
      properties: [
        {
          key: 'length',
          values: [{ uuid: 'real-uuid-1', value: '10' }],
        },
        {
          key: 'width',
          values: [{ uuid: 'real-uuid-2', value: '5' }],
        },
      ],
    }

    it('returns null when no formulaUuid', () => {
      const result = mapFormulaToStandaloneCalc(
        {},
        entity as any,
        'result-uuid'
      )
      expect(result).toBeNull()
    })

    it('maps composite IDs to real UUIDs', () => {
      const formulaData = {
        formulaUuid: 'formula-1',
        variableMapping: {
          x: { propertyKey: 'length', propertyUuid: 'prop-0::0' },
          y: { propertyKey: 'width', propertyUuid: 'prop-1::0' },
        },
      }

      const result = mapFormulaToStandaloneCalc(
        formulaData,
        entity as any,
        'result-uuid'
      )

      expect(result).not.toBeNull()
      expect(result!.args).toEqual(
        expect.arrayContaining([
          { name: 'x', propertyValueUUID: 'real-uuid-1' },
          { name: 'y', propertyValueUUID: 'real-uuid-2' },
        ])
      )
      expect(result!.result.propertyValueUUID).toBe('result-uuid')
    })

    it('returns null when composite ID cannot be resolved', () => {
      const formulaData = {
        formulaUuid: 'formula-1',
        variableMapping: {
          x: { propertyKey: 'length', propertyUuid: 'prop-99::0' },
        },
      }

      const result = mapFormulaToStandaloneCalc(
        formulaData,
        entity as any,
        'result-uuid'
      )
      expect(result).toBeNull()
    })

    it('returns null when no result UUID provided', () => {
      const formulaData = {
        formulaUuid: 'formula-1',
        variableMapping: {
          x: { propertyKey: 'length', propertyUuid: 'prop-0::0' },
        },
      }

      const result = mapFormulaToStandaloneCalc(formulaData, entity as any, '')
      expect(result).toBeNull()
    })
  })
})
