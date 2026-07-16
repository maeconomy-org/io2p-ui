import { describe, it, expect } from 'vitest'

import {
  entitySortToState,
  stateToEntitySort,
} from '@/components/tables/entity-table'

describe('entitySortToState', () => {
  it('undefined → empty state', () => {
    expect(entitySortToState(undefined)).toEqual([])
  })
  it('ascending', () => {
    expect(entitySortToState('name')).toEqual([{ id: 'name', desc: false }])
  })
  it('descending strips the "-" into the id', () => {
    expect(entitySortToState('-createdAt')).toEqual([
      { id: 'createdAt', desc: true },
    ])
  })
})

describe('stateToEntitySort', () => {
  it('empty → undefined', () => {
    expect(stateToEntitySort([])).toBeUndefined()
  })
  it('asc → bare key', () => {
    expect(stateToEntitySort([{ id: 'name', desc: false }])).toBe('name')
  })
  it('desc → "-" prefixed key', () => {
    expect(stateToEntitySort([{ id: 'updatedAt', desc: true }])).toBe(
      '-updatedAt'
    )
  })
  it('round-trips both directions', () => {
    for (const s of ['name', '-name', 'createdAt', '-updatedAt'] as const) {
      expect(stateToEntitySort(entitySortToState(s))).toBe(s)
    }
  })
})
