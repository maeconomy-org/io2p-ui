// The bind preview computes on the number the NODE computes on — the canonical one. Re-parsing the
// authored text gave `10 t` the value 10 while the evaluator used 10000, so every preview over a
// value authored in a non-canonical unit was wrong by that unit's factor, and silently right for kg.

import { describe, it, expect } from 'vitest'

import { collectSiblings } from '@/components/entity-sheet/fields/property-fields'
import type { EntityDraft } from '@/lib/entity'

const property = (
  key: string,
  value: EntityDraft['properties'][number]['values'][number]
): EntityDraft['properties'][number] => ({
  id: `p-${key}`,
  key,
  label: key,
  values: [value],
})

const numFor = (
  properties: EntityDraft['properties'],
  key: string
): number | undefined =>
  collectSiblings(properties, undefined, 'en').find(
    (s) => s.propertyKey === key
  )?.num

describe('collectSiblings', () => {
  it('uses the canonical number, not the authored text', () => {
    const properties = [
      property('weight', { id: 'v-1', data: '10 t', num: 10000, unit: 'kg' }),
    ]

    expect(numFor(properties, 'weight')).toBe(10000)
  })

  it('carries the canonical unit, so a declared-unit warning can compare against it', () => {
    const properties = [
      property('weight', { id: 'v-1', data: '10 t', num: 10000, unit: 'kg' }),
    ]

    expect(collectSiblings(properties, undefined, 'en')[0].unit).toBe('kg')
  })

  it('falls back to a just-typed BARE number, which has no canonical form yet', () => {
    // `num` lands with the READ, so a value authored a moment ago carries neither num nor unit.
    const properties = [property('count', { ref: 'r-1', data: '42' })]

    expect(numFor(properties, 'count')).toBe(42)
  })

  it('previews nothing for a just-typed value that carries a unit', () => {
    // "10 t" with no `num` yet: 10 is the wrong answer by 1000 and there is no right one to give.
    // The editor already renders such a sibling as selectable but unpreviewable.
    const properties = [property('weight', { ref: 'r-1', data: '10 t' })]

    expect(numFor(properties, 'weight')).toBeUndefined()
  })

  it('still offers a value nobody has filled in', () => {
    const properties = [property('weight', { ref: 'r-1', data: '' })]

    expect(collectSiblings(properties, undefined, 'en')).toHaveLength(1)
    expect(numFor(properties, 'weight')).toBeUndefined()
  })

  it('leaves text out — a formula over it would only produce NaN', () => {
    const properties = [property('supplier', { id: 'v-9', data: 'Acme' })]

    expect(collectSiblings(properties, undefined, 'en')).toHaveLength(0)
  })
})
