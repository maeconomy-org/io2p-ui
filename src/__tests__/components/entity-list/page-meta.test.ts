import { describe, it, expect } from 'vitest'
import type { Page } from 'io2p-client'

import { pageMeta } from '@/components/entity-list/page-meta'

const page = (over: Partial<Page<unknown>['page']>): Page<unknown> => ({
  data: [],
  page: { number: 1, size: 15, totalElements: 0, totalPages: 0, ...over },
})

describe('pageMeta', () => {
  it('maps a middle page (not first, not last)', () => {
    expect(
      pageMeta(page({ number: 2, size: 15, totalElements: 100, totalPages: 7 }))
    ).toEqual({
      currentPage: 2,
      totalPages: 7,
      totalElements: 100,
      pageSize: 15,
      isFirstPage: false,
      isLastPage: false,
    })
  })

  it('flags first and last pages', () => {
    expect(pageMeta(page({ number: 1, totalPages: 3 })).isFirstPage).toBe(true)
    expect(pageMeta(page({ number: 3, totalPages: 3 })).isLastPage).toBe(true)
  })

  it('empty result → single empty page, both first and last', () => {
    const m = pageMeta(page({ number: 1, totalElements: 0, totalPages: 0 }))
    expect(m.isFirstPage).toBe(true)
    expect(m.isLastPage).toBe(true)
    expect(m.totalPages).toBe(0)
  })

  it('undefined page → safe defaults with fallback size', () => {
    expect(pageMeta(undefined, 20)).toEqual({
      currentPage: 1,
      totalPages: 0,
      totalElements: 0,
      pageSize: 20,
      isFirstPage: true,
      isLastPage: true,
    })
  })
})
