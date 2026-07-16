import { describe, it, expect } from 'vitest'

import {
  parseEntityListQuery,
  entityListQueryToSearch,
} from '@/components/tables/use-entity-list-query'

const parse = (qs: string, defaults = {}) =>
  parseEntityListQuery(new URLSearchParams(qs), defaults)

describe('parseEntityListQuery', () => {
  it('empty params → defaults (page 1, size 15)', () => {
    expect(parse('')).toEqual({
      page: 1,
      size: 15,
      sort: undefined,
      q: undefined,
      scope: undefined,
      deleted: undefined,
    })
  })

  it('reads valid params', () => {
    expect(
      parse('page=3&size=25&sort=-name&q=wall&scope=all&deleted=include')
    ).toEqual({
      page: 3,
      size: 25,
      sort: '-name',
      q: 'wall',
      scope: 'all',
      deleted: 'include',
    })
  })

  it('rejects out-of-range page and invalid enum values', () => {
    const q = parse('page=0&sort=bogus&scope=galaxy&deleted=maybe')
    expect(q.page).toBe(1)
    expect(q.sort).toBeUndefined()
    expect(q.scope).toBeUndefined()
    expect(q.deleted).toBeUndefined()
  })

  it('applies caller defaults for size/sort/scope', () => {
    const q = parse('', { size: 20, sort: 'name', scope: 'mine' })
    expect(q).toMatchObject({ size: 20, sort: 'name', scope: 'mine' })
  })
})

describe('entityListQueryToSearch', () => {
  it('omits defaults (clean URL)', () => {
    expect(entityListQueryToSearch({ page: 1, size: 15, q: undefined })).toBe(
      ''
    )
  })

  it('serializes only non-defaults', () => {
    const qs = entityListQueryToSearch(
      {
        page: 2,
        size: 15,
        sort: 'name',
        q: 'x',
        scope: 'all',
        deleted: 'only',
      },
      { size: 15 }
    )
    const p = new URLSearchParams(qs)
    expect(p.get('page')).toBe('2')
    expect(p.get('size')).toBeNull() // equals default → omitted
    expect(p.get('sort')).toBe('name')
    expect(p.get('q')).toBe('x')
    expect(p.get('scope')).toBe('all')
    expect(p.get('deleted')).toBe('only')
  })

  it('round-trips through parse', () => {
    const original = {
      page: 4,
      size: 30,
      sort: '-createdAt' as const,
      q: 'beam',
      scope: 'shared' as const,
      deleted: 'exclude' as const,
    }
    const round = parse(entityListQueryToSearch(original))
    // `deleted: 'exclude'` is serialized (not a default here) and parsed back.
    expect(round).toMatchObject({
      page: 4,
      size: 30,
      sort: '-createdAt',
      q: 'beam',
      scope: 'shared',
      deleted: 'exclude',
    })
  })
})
