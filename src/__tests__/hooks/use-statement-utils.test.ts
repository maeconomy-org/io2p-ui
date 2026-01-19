import { describe, it, expect } from 'vitest'
import {
  getPropertyValue,
  processRelationshipStatement,
} from '@/hooks/process/use-statement-utils'
import type { UUStatementDTO } from 'iom-sdk'

// Helper to create mock statements with minimal required fields
const createMockStatement = (
  overrides: Partial<UUStatementDTO> = {}
): UUStatementDTO =>
  ({
    subject: 'subject-uuid',
    predicate: 'HAS_RELATIONSHIP',
    object: 'object-uuid',
    ...overrides,
  }) as unknown as UUStatementDTO

describe('use-statement-utils', () => {
  describe('getPropertyValue', () => {
    it('should return value when property exists', () => {
      const statement = createMockStatement({
        properties: [{ key: 'testKey', values: [{ value: 'testValue' }] }],
      })

      expect(getPropertyValue(statement, 'testKey')).toBe('testValue')
    })

    it('should return null when property does not exist', () => {
      const statement = createMockStatement({
        properties: [{ key: 'otherKey', values: [{ value: 'testValue' }] }],
      })

      expect(getPropertyValue(statement, 'testKey')).toBeNull()
    })

    it('should return null when properties is undefined', () => {
      const statement = createMockStatement({})
      expect(getPropertyValue(statement, 'testKey')).toBeNull()
    })

    it('should return null when values array is empty', () => {
      const statement = createMockStatement({
        properties: [{ key: 'testKey', values: [] }],
      })

      expect(getPropertyValue(statement, 'testKey')).toBeNull()
    })

    it('should return first value when multiple values exist', () => {
      const statement = createMockStatement({
        properties: [
          {
            key: 'testKey',
            values: [{ value: 'first' }, { value: 'second' }],
          },
        ],
      })

      expect(getPropertyValue(statement, 'testKey')).toBe('first')
    })
  })

  describe('processRelationshipStatement', () => {
    it('should process a valid relationship statement', () => {
      const statement = createMockStatement({
        properties: [
          { key: 'processName', values: [{ value: 'Manufacturing' }] },
          { key: 'quantity', values: [{ value: '100' }] },
          { key: 'unit', values: [{ value: 'kg' }] },
        ],
      })

      const result = processRelationshipStatement(statement)

      expect(result).toEqual({
        processName: 'Manufacturing',
        quantity: 100,
        unit: 'kg',
        subject: 'subject-uuid',
        object: 'object-uuid',
        isValid: true,
      })
    })

    it('should return isValid false for unknown process', () => {
      const statement = createMockStatement({
        properties: [],
      })

      const result = processRelationshipStatement(statement)

      expect(result.processName).toBe('Unknown Process')
      expect(result.isValid).toBe(false)
    })

    it('should return isValid false for empty process name', () => {
      const statement = createMockStatement({
        properties: [{ key: 'processName', values: [{ value: '   ' }] }],
      })

      const result = processRelationshipStatement(statement)
      expect(result.isValid).toBe(false)
    })

    it('should handle missing quantity and unit', () => {
      const statement = createMockStatement({
        properties: [{ key: 'processName', values: [{ value: 'Assembly' }] }],
      })

      const result = processRelationshipStatement(statement)

      expect(result.quantity).toBe(0)
      expect(result.unit).toBe('')
      expect(result.isValid).toBe(true)
    })

    it('should parse quantity as float', () => {
      const statement = createMockStatement({
        properties: [
          { key: 'processName', values: [{ value: 'Process' }] },
          { key: 'quantity', values: [{ value: '10.5' }] },
        ],
      })

      const result = processRelationshipStatement(statement)
      expect(result.quantity).toBe(10.5)
    })

    it('should handle invalid quantity as NaN', () => {
      const statement = createMockStatement({
        properties: [
          { key: 'processName', values: [{ value: 'Process' }] },
          { key: 'quantity', values: [{ value: 'invalid' }] },
        ],
      })

      const result = processRelationshipStatement(statement)
      expect(result.quantity).toBeNaN()
    })
  })
})
