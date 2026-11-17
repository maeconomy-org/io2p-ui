import { describe, it, expect } from 'vitest'

import {
  CAPPED_TOTAL,
  isCappedCount,
  isCappedTotal,
  isLastListPage,
  mayHaveChildren,
  sumTotals,
} from '@/lib/list-total'

describe('isCappedTotal', () => {
  it('reads 1001 as capped only on a list the node caps', () => {
    expect(isCappedTotal(CAPPED_TOTAL, true)).toBe(true)
    expect(isCappedTotal(CAPPED_TOTAL, false)).toBe(false)
  })

  it('reads 1000 and 1002 as exact numbers', () => {
    expect(isCappedTotal(1000, true)).toBe(false)
    expect(isCappedTotal(1002, true)).toBe(false)
  })

  it('reads an absent total as not capped', () => {
    expect(isCappedTotal(undefined, true)).toBe(false)
  })
})

describe('isCappedCount', () => {
  it('treats 1001 as capped without a list flag', () => {
    expect(isCappedCount(CAPPED_TOTAL)).toBe(true)
    expect(isCappedCount(999)).toBe(false)
    expect(isCappedCount(undefined)).toBe(false)
  })
})

describe('mayHaveChildren', () => {
  it('counts only an explicit 0 as a leaf', () => {
    expect(mayHaveChildren(0)).toBe(false)
    expect(mayHaveChildren(undefined)).toBe(true)
    expect(mayHaveChildren(3)).toBe(true)
  })
})

describe('isLastListPage', () => {
  const base = { page: 51, totalPages: 51, size: 20 }

  it('keeps a full capped page open, even at the reported page count', () => {
    expect(isLastListPage({ ...base, capped: true, rows: 20 })).toBe(false)
  })

  it('ends a capped list on a short or empty page', () => {
    expect(isLastListPage({ ...base, capped: true, rows: 7 })).toBe(true)
    expect(isLastListPage({ ...base, capped: true, rows: 0 })).toBe(true)
  })

  it('ends an exact list at its page count', () => {
    expect(isLastListPage({ ...base, capped: false, rows: 20 })).toBe(true)
    expect(isLastListPage({ ...base, page: 50, capped: false, rows: 20 })).toBe(
      false
    )
  })

  it('treats an exact list with no pages (no answer) as ended', () => {
    expect(
      isLastListPage({ ...base, totalPages: 0, capped: false, rows: 0 })
    ).toBe(true)
  })
})

describe('sumTotals', () => {
  it('adds exact totals as they are', () => {
    expect(sumTotals([20, 5], true)).toEqual({ total: 25, capped: false })
  })

  it('adds a capped total as 1,000 and marks the sum a lower limit', () => {
    expect(sumTotals([CAPPED_TOTAL, 5], true)).toEqual({
      total: 1005,
      capped: true,
    })
    expect(sumTotals([CAPPED_TOTAL, CAPPED_TOTAL], true)).toEqual({
      total: 2000,
      capped: true,
    })
  })

  it('adds 1001 exactly on a list the node counts exactly', () => {
    expect(sumTotals([CAPPED_TOTAL, 5], false)).toEqual({
      total: 1006,
      capped: false,
    })
  })

  it('sums nothing to an exact 0', () => {
    expect(sumTotals([], true)).toEqual({ total: 0, capped: false })
  })
})
