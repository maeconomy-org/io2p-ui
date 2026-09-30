import { describe, it, expect } from 'vitest'

import { derivedValueMap } from '@/components/entity-sheet/fields/value-provenance'

const trace = {
  expression: 'a * b',
  args: [],
  unitSource: 'inherited',
} as never

describe('which values the node calculated', () => {
  it('keeps calculated values only, with their trace', () => {
    const map = derivedValueMap([
      {
        values: [
          { id: 'typed', source: 'authored' },
          { id: 'calc', source: 'derived', provenance: trace },
        ],
      },
    ])

    expect([...map.keys()]).toEqual(['calc'])
    expect(map.get('calc')).toBe(trace)
  })

  it('reads every list it is given — a process and each of its flows', () => {
    const map = derivedValueMap(
      [{ values: [{ id: 'own', source: 'derived' }] }],
      [{ values: [{ id: 'in-flow', source: 'derived' }] }],
      undefined,
      [{ values: [{ id: 'out-flow', source: 'derived' }] }]
    )

    expect([...map.keys()]).toEqual(['own', 'in-flow', 'out-flow'])
  })
})
