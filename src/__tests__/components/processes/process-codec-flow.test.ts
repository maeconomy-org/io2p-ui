import { describe, it, expect } from 'vitest'
import {
  encodeProcess,
  getEdgeQuantity,
} from '@/components/processes/utils/process-codec'
import type { ProcessModel } from '@/types/process'

const model: ProcessModel = {
  processId: 'p1',
  name: 'P',
  properties: [],
  inputs: [
    {
      objectUuid: 'in-1',
      properties: [
        {
          key: 'quantity',
          label: 'Quantity',
          values: ['0.1 t'],
          isQuantity: true,
        },
      ],
    },
  ],
  outputs: [
    {
      objectUuid: 'out-1',
      properties: [
        { key: 'mass', label: 'Mass', values: ['1 pcs'], isQuantity: true },
      ],
    },
  ],
}

describe('getEdgeQuantity', () => {
  it('reads the canonical value and unit of the flagged input/output quantity', () => {
    const [edge] = encodeProcess(model)
    expect(getEdgeQuantity(edge, 'in')).toEqual({
      canonical: 100, // 0.1 t -> 100 kg
      unit: 't',
      raw: '0.1 t',
    })
    // works regardless of the property key name (here it's "mass", not "quantity")
    expect(getEdgeQuantity(edge, 'out')).toEqual({
      canonical: 1,
      unit: 'pcs',
      raw: '1 pcs',
    })
  })

  it('returns nulls when no quantity is flagged on that side', () => {
    const noQty: ProcessModel = {
      ...model,
      inputs: [
        {
          objectUuid: 'in-1',
          properties: [{ key: 'note', label: 'Note', values: ['x'] }],
        },
      ],
    }
    const [edge] = encodeProcess(noQty)
    expect(getEdgeQuantity(edge, 'in')).toEqual({
      canonical: null,
      unit: null,
      raw: null,
    })
  })

  it('keeps the number when the quantity has no recognizable unit', () => {
    const unitless: ProcessModel = {
      ...model,
      inputs: [
        {
          objectUuid: 'in-1',
          properties: [
            { key: 'count', label: 'Count', values: ['42'], isQuantity: true },
          ],
        },
      ],
    }
    const [edge] = encodeProcess(unitless)
    const q = getEdgeQuantity(edge, 'in')
    expect(q.canonical).toBe(42)
    expect(q.unit).toBeNull()
  })
})
