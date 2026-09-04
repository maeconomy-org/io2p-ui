import { describe, it, expect } from 'vitest'

import { queryKeys } from '@/lib/query-keys'

describe('queryKeys.access.grants.forResource', () => {
  // THE REGRESSION. `revoked` changes WHICH ROWS come back, so a key that ignored the query would
  // hand the active-only response to a caller asking for revoked ones — the same shape as the
  // detail-prefetch bug, where a request was cached under a key nothing could read.
  it('separates an active-only read from one that includes revoked rows', () => {
    const active = queryKeys.access.grants.forResource('object', 'obj-1')
    const withRevoked = queryKeys.access.grants.forResource('object', 'obj-1', {
      revoked: 'include',
    })

    expect(active).not.toEqual(withRevoked)
  })

  it('separates the three revoked modes from each other', () => {
    const key = (revoked: string) =>
      JSON.stringify(
        queryKeys.access.grants.forResource('object', 'obj-1', { revoked })
      )

    expect(new Set(['exclude', 'include', 'only'].map(key)).size).toBe(3)
  })

  it('still separates resources, as it always did', () => {
    const a = queryKeys.access.grants.forResource('object', 'obj-1')
    const b = queryKeys.access.grants.forResource('object', 'obj-2')
    const c = queryKeys.access.grants.forResource('process', 'obj-1')

    expect(new Set([a, b, c].map((k) => JSON.stringify(k))).size).toBe(3)
  })

  it('is stable for the same query, so a re-render is a cache hit', () => {
    expect(
      queryKeys.access.grants.forResource('object', 'obj-1', {
        revoked: 'include',
      })
    ).toEqual(
      queryKeys.access.grants.forResource('object', 'obj-1', {
        revoked: 'include',
      })
    )
  })
})
