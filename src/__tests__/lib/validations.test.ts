import { describe, it, expect } from 'vitest'
import {
  propertyValueSchema,
  propertySchema,
  addressSchema,
  objectModelSchema,
  objectSchema,
} from '@/lib/validations/object-model'

describe('validations/object-model', () => {
  describe('propertyValueSchema', () => {
    it('should validate a valid property value', () => {
      const result = propertyValueSchema.safeParse({
        value: 'test value',
        files: [],
      })
      expect(result.success).toBe(true)
    })

    it('should allow empty value (formula values start empty)', () => {
      const result = propertyValueSchema.safeParse({
        value: '',
        files: [],
      })
      expect(result.success).toBe(true)
    })

    it('should allow value with formulaData', () => {
      const result = propertyValueSchema.safeParse({
        value: '42',
        files: [],
        formulaData: {
          formula: 'x + y',
          variableMapping: { x: { propertyKey: 'a', propertyUuid: 'uuid-1' } },
          result: 42,
          resolvedExpression: '20 + 22',
          isValid: true,
        },
      })
      expect(result.success).toBe(true)
    })

    it('should allow optional uuid', () => {
      const result = propertyValueSchema.safeParse({
        uuid: 'some-uuid',
        value: 'test',
        files: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('propertySchema', () => {
    it('should validate a valid property', () => {
      const result = propertySchema.safeParse({
        key: 'testKey',
        values: [{ value: 'test value', files: [] }],
        files: [],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty key', () => {
      const result = propertySchema.safeParse({
        key: '',
        values: [{ value: 'test', files: [] }],
        files: [],
      })
      expect(result.success).toBe(false)
    })

    it('should allow optional uuid', () => {
      const result = propertySchema.safeParse({
        uuid: 'prop-uuid',
        key: 'testKey',
        values: [],
        files: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('addressSchema', () => {
    it('should validate a valid address', () => {
      const result = addressSchema.safeParse({
        fullAddress: '123 Main St, City, Country',
        components: {
          street: 'Main St',
          houseNumber: '123',
          city: 'City',
          country: 'Country',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty fullAddress', () => {
      const result = addressSchema.safeParse({
        fullAddress: '',
        components: {},
      })
      expect(result.success).toBe(false)
    })

    it('should allow empty components', () => {
      const result = addressSchema.safeParse({
        fullAddress: '123 Main St',
        components: {},
      })
      expect(result.success).toBe(true)
    })
  })

  describe('objectModelSchema', () => {
    it('should validate a valid object model', () => {
      const result = objectModelSchema.safeParse({
        name: 'Test Model',
        properties: [],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = objectModelSchema.safeParse({
        name: '',
        properties: [],
      })
      expect(result.success).toBe(false)
    })

    it('should allow optional fields', () => {
      const result = objectModelSchema.safeParse({
        name: 'Test Model',
        abbreviation: 'TM',
        version: '1.0',
        description: 'A test model',
        properties: [],
      })
      expect(result.success).toBe(true)
    })

    it('should validate with properties', () => {
      const result = objectModelSchema.safeParse({
        name: 'Test Model',
        properties: [
          {
            key: 'prop1',
            values: [{ value: 'val1', files: [] }],
            files: [],
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('objectSchema', () => {
    it('should validate a valid object', () => {
      const result = objectSchema.safeParse({
        name: 'Test Object',
        properties: [],
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = objectSchema.safeParse({
        name: '',
        properties: [],
      })
      expect(result.success).toBe(false)
    })

    it('should allow optional address', () => {
      const result = objectSchema.safeParse({
        name: 'Test Object',
        properties: [],
        address: {
          fullAddress: '123 Main St',
          components: {},
        },
      })
      expect(result.success).toBe(true)
    })

    it('should allow optional parents array', () => {
      const result = objectSchema.safeParse({
        name: 'Test Object',
        properties: [],
        parents: ['parent-uuid-1', 'parent-uuid-2'],
      })
      expect(result.success).toBe(true)
    })

    it('should default isTemplate to false', () => {
      const result = objectSchema.safeParse({
        name: 'Test Object',
        properties: [],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isTemplate).toBe(false)
      }
    })

    it('should allow all optional fields', () => {
      const result = objectSchema.safeParse({
        uuid: 'obj-uuid',
        name: 'Test Object',
        abbreviation: 'TO',
        version: '1.0',
        description: 'A test object',
        properties: [],
        files: [],
        modelUuid: 'model-uuid',
        isTemplate: true,
      })
      expect(result.success).toBe(true)
    })
  })
})
