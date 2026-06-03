import { describe, it, expect } from 'vitest'
import {
  encodeProcess,
  decodeProcess,
  groupEdgesByProcess,
} from '@/components/processes/utils/process-codec'
import type { ProcessModel } from '@/types/process'

const baseModel: ProcessModel = {
  processId: 'p-123',
  name: 'Recycle A',
  type: 'processing',
  description: 'crush + sort',
  properties: [{ key: 'method', label: 'Method', values: ['crushing'] }],
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

/** Helper: read a single statement-property value by key. */
function val(
  edge: { properties?: { key?: string; values?: { value?: string }[] }[] },
  key: string
) {
  return edge.properties?.find((p) => p.key === key)?.values?.[0]?.value
}

describe('process-codec', () => {
  describe('encodeProcess', () => {
    it('creates one IS_INPUT_OF edge per input×output pair', () => {
      const model: ProcessModel = {
        ...baseModel,
        inputs: [
          { objectUuid: 'in-1', properties: [] },
          { objectUuid: 'in-2', properties: [] },
        ],
        outputs: [
          { objectUuid: 'out-1', properties: [] },
          { objectUuid: 'out-2', properties: [] },
          { objectUuid: 'out-3', properties: [] },
        ],
      }
      const edges = encodeProcess(model)
      expect(edges).toHaveLength(6)
      expect(edges.every((e) => e.predicate === 'IS_INPUT_OF')).toBe(true)
    })

    it('stamps processId + identity on every edge', () => {
      const edges = encodeProcess({
        ...baseModel,
        inputs: [
          { objectUuid: 'in-1', properties: [] },
          { objectUuid: 'in-2', properties: [] },
        ],
      })
      expect(edges).toHaveLength(2)
      for (const e of edges) {
        expect(val(e, 'processId')).toBe('p-123')
        expect(val(e, 'processName')).toBe('Recycle A')
        expect(val(e, 'processType')).toBe('processing')
      }
    })

    it('writes #unit and #canon for a quantity property', () => {
      const [edge] = encodeProcess(baseModel)
      expect(val(edge, 'in.quantity')).toBe('0.1 t') // raw, as typed
      expect(val(edge, 'in.quantity#qty')).toBe('1')
      expect(val(edge, 'in.quantity#unit')).toBe('t')
      expect(val(edge, 'in.quantity#canon')).toBe('100') // 0.1 t -> 100 kg
      expect(val(edge, 'in.quantity#label')).toBe('Quantity')
    })

    it('omits #unit for a unitless quantity but still writes #canon', () => {
      const [edge] = encodeProcess({
        ...baseModel,
        inputs: [
          {
            objectUuid: 'in-1',
            properties: [
              {
                key: 'quantity',
                label: 'Quantity',
                values: ['100'],
                isQuantity: true,
              },
            ],
          },
        ],
      })
      expect(val(edge, 'in.quantity#canon')).toBe('100')
      expect(val(edge, 'in.quantity#unit')).toBeUndefined()
    })

    it('does not flag or canonicalize process-level props', () => {
      const [edge] = encodeProcess(baseModel)
      expect(val(edge, 'p.method')).toBe('crushing')
      expect(val(edge, 'p.method#label')).toBe('Method')
      expect(val(edge, 'p.method#qty')).toBeUndefined()
      expect(val(edge, 'p.method#canon')).toBeUndefined()
    })

    it('returns [] when there are no inputs or no outputs', () => {
      expect(encodeProcess({ ...baseModel, inputs: [] })).toEqual([])
      expect(encodeProcess({ ...baseModel, outputs: [] })).toEqual([])
    })
  })

  describe('encode -> decode round-trip', () => {
    it('reconstructs an equivalent model', () => {
      const decoded = decodeProcess(encodeProcess(baseModel))
      expect(decoded).not.toBeNull()
      expect(decoded!.processId).toBe('p-123')
      expect(decoded!.name).toBe('Recycle A')
      expect(decoded!.type).toBe('processing')
      expect(decoded!.description).toBe('crush + sort')
      expect(decoded!.properties).toEqual([
        { key: 'method', label: 'Method', values: ['crushing'] },
      ])
      expect(decoded!.inputs).toEqual([
        {
          objectUuid: 'in-1',
          properties: [
            {
              key: 'quantity',
              label: 'Quantity',
              values: ['0.1 t'],
              isQuantity: true,
              unit: 't',
              canonicalValue: 100,
            },
          ],
        },
      ])
      expect(decoded!.outputs[0].properties[0]).toMatchObject({
        key: 'quantity',
        isQuantity: true,
        unit: 'pcs',
        canonicalValue: 1,
      })
    })

    it('preserves multiple inputs and outputs distinctly', () => {
      const model: ProcessModel = {
        ...baseModel,
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
          {
            objectUuid: 'in-2',
            properties: [
              {
                key: 'quantity',
                label: 'Quantity',
                values: ['2 t'],
                isQuantity: true,
              },
            ],
          },
        ],
      }
      const decoded = decodeProcess(encodeProcess(model))!
      expect(decoded.inputs.map((i) => i.objectUuid)).toEqual(['in-1', 'in-2'])
      expect(decoded.inputs[1].properties[0].canonicalValue).toBe(2000)
    })

    it('preserves a property with multiple values', () => {
      const model: ProcessModel = {
        ...baseModel,
        properties: [{ key: 'tags', label: 'Tags', values: ['a', 'b', 'c'] }],
      }
      const decoded = decodeProcess(encodeProcess(model))!
      expect(decoded.properties[0].values).toEqual(['a', 'b', 'c'])
    })
  })

  describe('decodeProcess edge cases', () => {
    it('returns null for an empty edge list', () => {
      expect(decodeProcess([])).toBeNull()
    })
  })

  describe('groupEdgesByProcess', () => {
    it('splits a mixed edge list by processId and ignores edges without one', () => {
      const a = encodeProcess(baseModel)
      const b = encodeProcess({
        ...baseModel,
        processId: 'p-999',
        name: 'Other',
      })
      const orphan = {
        subject: 'x',
        predicate: 'IS_INPUT_OF',
        object: 'y',
        properties: [],
      } as never
      const groups = groupEdgesByProcess([...a, ...b, orphan])
      expect([...groups.keys()].sort()).toEqual(['p-123', 'p-999'])
      expect(groups.get('p-123')).toHaveLength(a.length)
    })
  })
})
