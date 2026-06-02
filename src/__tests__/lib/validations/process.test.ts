import { describe, it, expect } from 'vitest'
import { processSchema, getQuantityWarnings } from '@/lib/validations/process'

const validForm = {
  name: 'Recycle A',
  properties: [],
  inputs: [
    {
      objectUuid: 'in-1',
      properties: [
        {
          key: 'quantity',
          label: 'Quantity',
          values: ['100 kg'],
          isQuantity: true,
        },
      ],
    },
  ],
  outputs: [
    {
      objectUuid: 'out-1',
      properties: [
        {
          key: 'quantity',
          label: 'Quantity',
          values: ['1 pcs'],
          isQuantity: true,
        },
      ],
    },
  ],
}

describe('process validation', () => {
  describe('processSchema', () => {
    it('accepts a valid process', () => {
      expect(processSchema.safeParse(validForm).success).toBe(true)
    })

    it('rejects an empty / whitespace-only name', () => {
      expect(processSchema.safeParse({ ...validForm, name: '' }).success).toBe(
        false
      )
      expect(
        processSchema.safeParse({ ...validForm, name: '   ' }).success
      ).toBe(false)
    })

    it('requires at least one input and one output', () => {
      expect(
        processSchema.safeParse({ ...validForm, inputs: [] }).success
      ).toBe(false)
      expect(
        processSchema.safeParse({ ...validForm, outputs: [] }).success
      ).toBe(false)
    })

    it('requires a selected object on each material', () => {
      const bad = {
        ...validForm,
        inputs: [{ objectUuid: '', properties: [] }],
      }
      expect(processSchema.safeParse(bad).success).toBe(false)
    })

    it('does NOT block on an unparseable quantity value', () => {
      const form = {
        ...validForm,
        inputs: [
          {
            objectUuid: 'in-1',
            properties: [
              {
                key: 'quantity',
                label: 'Quantity',
                values: ['n/a'],
                isQuantity: true,
              },
            ],
          },
        ],
      }
      expect(processSchema.safeParse(form).success).toBe(true)
    })

    it('defaults isQuantity to false on material properties', () => {
      const parsed = processSchema.parse({
        ...validForm,
        inputs: [
          {
            objectUuid: 'in-1',
            properties: [{ key: 'note', label: 'Note', values: ['x'] }],
          },
        ],
      })
      expect(parsed.inputs[0].properties[0].isQuantity).toBe(false)
    })
  })

  describe('getQuantityWarnings', () => {
    it('returns no warnings when quantities parse', () => {
      expect(getQuantityWarnings(validForm)).toEqual([])
    })

    it('flags a quantity property with no parseable number', () => {
      const form = {
        inputs: [
          {
            objectUuid: 'in-1',
            properties: [
              {
                key: 'quantity',
                label: 'Quantity',
                values: ['abc'],
                isQuantity: true,
              },
            ],
          },
        ],
        outputs: [
          {
            objectUuid: 'out-1',
            properties: [
              {
                key: 'quantity',
                label: 'Quantity',
                values: [''],
                isQuantity: true,
              },
            ],
          },
        ],
      }
      const warnings = getQuantityWarnings(form)
      expect(warnings).toEqual([
        { side: 'input', objectUuid: 'in-1', key: 'quantity' },
        { side: 'output', objectUuid: 'out-1', key: 'quantity' },
      ])
    })

    it('ignores non-quantity properties even if non-numeric', () => {
      const form = {
        inputs: [
          {
            objectUuid: 'in-1',
            properties: [{ key: 'note', label: 'Note', values: ['hello'] }],
          },
        ],
        outputs: [],
      }
      expect(getQuantityWarnings(form)).toEqual([])
    })
  })
})
