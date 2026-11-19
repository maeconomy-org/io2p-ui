import { describe, it, expect } from 'vitest'
import type { Page } from 'io2p-client'

import { pageMeta } from '@/components/entity-list/page-meta'

const page = (over: Partial<Page<unknown>['page']>): Page<unknown> => ({
  data: [],
  page: { number: 1, size: 15, totalElements: 0, totalPages: 0, ...over },
})

/** A page as the node sends it: `rows` rows, the total and `totalPages = ceil(total / size)`. */
const answered = (
  number: number,
  rows: number,
  totalElements: number,
  size = 20
): Page<unknown> => ({
  data: Array.from({ length: rows }, (_, i) => ({ id: i })),
  page: {
    number,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  },
})

describe('pageMeta', () => {
  it('maps a middle page (not first, not last)', () => {
    expect(pageMeta(answered(2, 15, 100, 15))).toEqual({
      currentPage: 2,
      totalPages: 7,
      totalElements: 100,
      pageSize: 15,
      capped: false,
      rowsOnPage: 15,
      pastEnd: false,
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
    expect(m.pastEnd).toBe(false)
  })

  it('undefined page → safe defaults with fallback size', () => {
    expect(pageMeta(undefined, 20)).toEqual({
      currentPage: 1,
      totalPages: 0,
      totalElements: 0,
      pageSize: 20,
      capped: false,
      rowsOnPage: 0,
      pastEnd: false,
      isFirstPage: true,
      isLastPage: true,
    })
  })

  describe('a capped total (1001)', () => {
    it('keeps next on at page 51 of 51 while the page is full', () => {
      const m = pageMeta(answered(51, 20, 1001), 20, { capped: true })
      expect(m.capped).toBe(true)
      expect(m.totalPages).toBe(51)
      expect(m.isLastPage).toBe(false)
    })

    it('ends the list at a page with fewer rows than asked', () => {
      expect(
        pageMeta(answered(63, 7, 1001), 20, { capped: true }).isLastPage
      ).toBe(true)
    })

    it('is an exact number on a list the node does not cap', () => {
      const m = pageMeta(answered(51, 1, 1001), 20, { capped: false })
      expect(m.capped).toBe(false)
      expect(m.isLastPage).toBe(true)
    })
  })

  describe('a page past the end of the list', () => {
    it('is past the end when the node answers it empty with 1001', () => {
      const m = pageMeta(answered(60, 0, 1001), 20, { capped: true })
      expect(m.pastEnd).toBe(true)
      expect(m.isLastPage).toBe(true)
    })

    it('is past the end when the node answers it empty with an exact smaller total', () => {
      const m = pageMeta(answered(60, 0, 900), 20, { capped: true })
      expect(m.pastEnd).toBe(true)
      expect(m.capped).toBe(false)
      expect(m.isLastPage).toBe(true)
    })

    it('is not past the end when there is no answer (an error)', () => {
      const m = pageMeta(undefined, 20, { capped: true, requestedPage: 60 })
      expect(m.pastEnd).toBe(false)
    })
  })

  it('keeps the requested page when there is no answer, so previous stays on', () => {
    const m = pageMeta(undefined, 20, { capped: true, requestedPage: 60 })
    expect(m.currentPage).toBe(60)
    expect(m.isFirstPage).toBe(false)
  })
})
