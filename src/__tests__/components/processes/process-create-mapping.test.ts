import { describe, it, expect } from 'vitest'
import {
  toProcessModel,
  slugifyKey,
} from '@/components/processes/sheets/process-create-sheet'
import { processSchema } from '@/lib/validations/process'
import { encodeProcess } from '@/components/processes/utils/process-codec'

// Mirrors what the sheet's RHF state looks like for a normal create.
const happyForm = {
  name: 'Recycle A',
  type: '',
  description: '',
  properties: [],
  inputs: [
    {
      objectUuid: 'in-1',
      objectName: 'Concrete',
      properties: [
        {
          key: 'quantity',
          label: 'Quantity',
          values: [{ value: '100 kg' }],
          isQuantity: true,
        },
      ],
    },
  ],
  outputs: [
    {
      objectUuid: 'out-1',
      objectName: 'Wall',
      properties: [
        {
          key: 'quantity',
          label: 'Quantity',
          values: [{ value: '1 pcs' }],
          isQuantity: true,
        },
      ],
    },
  ],
}

describe('process-create mapping', () => {
  describe('slugifyKey', () => {
    it('turns a label into a code key', () => {
      expect(slugifyKey('Net Weight')).toBe('net_weight')
      expect(slugifyKey('  CO2 / unit ')).toBe('co2_unit')
      expect(slugifyKey('')).toBe('')
    })
  })

  describe('toProcessModel + validation (the happy path)', () => {
    it('produces a model that passes processSchema', () => {
      const model = toProcessModel(happyForm)
      const result = processSchema.safeParse(model)
      expect(result.success).toBe(true)
    })

    it('encodes to IS_INPUT_OF edges with canonical quantity', () => {
      const edges = encodeProcess({
        ...toProcessModel(happyForm),
        processId: 'p1',
      })
      expect(edges).toHaveLength(1)
      const bag = edges[0].properties ?? []
      const val = (k: string) =>
        bag.find((p) => p.key === k)?.values?.[0]?.value
      expect(val('in.quantity#canon')).toBe('100')
      expect(val('out.quantity#canon')).toBe('1')
    })
  })

  describe('forgiving mapping (the bug the user hit)', () => {
    it('drops empty property rows instead of failing "name required"', () => {
      const form = {
        ...happyForm,
        // user clicked "Add property" but never filled it
        properties: [{ key: '', label: '', values: [{ value: '' }] }],
      }
      const model = toProcessModel(form)
      expect(model.properties).toEqual([])
      expect(processSchema.safeParse(model).success).toBe(true)
    })

    it('derives a key from the label when only a name was typed', () => {
      const form = {
        ...happyForm,
        properties: [
          { key: '', label: 'Energy Use', values: [{ value: '42 kWh' }] },
        ],
      }
      const model = toProcessModel(form)
      expect(model.properties[0]).toMatchObject({
        key: 'energy_use',
        label: 'Energy Use',
        values: ['42 kWh'],
      })
      expect(processSchema.safeParse(model).success).toBe(true)
    })

    it('still fails clearly when a process has no outputs', () => {
      const model = toProcessModel({ ...happyForm, outputs: [] })
      const result = processSchema.safeParse(model)
      expect(result.success).toBe(false)
    })
  })
})
