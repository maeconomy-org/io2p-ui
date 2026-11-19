import { describe, it, expect } from 'vitest'

import { pageWindow } from '@/components/ui/page-window'

const base = { capped: false, isLastPage: false, maxButtons: 5 }

describe('pageWindow', () => {
  it('shows the known pages of a capped list on page 1, not only the next one', () => {
    const w = pageWindow({
      ...base,
      capped: true,
      currentPage: 0,
      totalPages: 51,
    })
    expect(w.pageNumbers).toEqual([0, 1, 2, 3, 4])
    expect(w.pageLine).toBe('pageOfAtLeast')
  })

  it('offers one page past a capped total while the page is full', () => {
    const w = pageWindow({
      ...base,
      capped: true,
      currentPage: 50,
      totalPages: 51,
    })
    expect(w.knownPages).toBe(52)
    expect(w.pageNumbers).toEqual([47, 48, 49, 50, 51])
  })

  it('offers nothing past a capped page that is short', () => {
    const w = pageWindow({
      ...base,
      capped: true,
      isLastPage: true,
      currentPage: 55,
      totalPages: 51,
    })
    expect(w.knownPages).toBe(56)
    expect(w.pageNumbers.at(-1)).toBe(55)
    expect(w.pageLine).toBe('pageOnly')
  })

  it('names only the page when no page meta came back (an error)', () => {
    const w = pageWindow({ ...base, currentPage: 59, totalPages: 0 })
    expect(w.pageLine).toBe('pageOnly')
    expect(w.pageNumbers.at(-1)).toBe(59)
  })

  it('keeps the page the user is on past an exact total that shrank', () => {
    const w = pageWindow({ ...base, currentPage: 59, totalPages: 45 })
    expect(w.knownPages).toBe(60)
    expect(w.pageLine).toBe('pageOnly')
  })

  it('reads "page of" on an exact total', () => {
    const w = pageWindow({ ...base, currentPage: 2, totalPages: 9 })
    expect(w.pageNumbers).toEqual([1, 2, 3, 4, 5])
    expect(w.pageLine).toBe('pageOf')
  })

  it('shows fewer buttons than the maximum on a short list', () => {
    expect(
      pageWindow({ ...base, currentPage: 0, totalPages: 2 }).pageNumbers
    ).toEqual([0, 1])
  })
})
