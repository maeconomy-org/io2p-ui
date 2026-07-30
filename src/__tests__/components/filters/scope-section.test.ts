import { describe, it, expect, vi } from 'vitest'

import { scopeSection } from '@/components/filters/filter-menu'

const t = (key: string) => key

describe('scopeSection', () => {
  it('shows nothing selected for `all`, so the trigger badge stays clear', () => {
    // `all` IS the unfiltered state. Rendering it as a selected option would put a permanent 1 on
    // the count badge and make "no filters" indistinguishable from "one filter".
    expect(scopeSection(t, 'all', vi.fn()).selected).toEqual([])
  })

  it('reflects the active slice', () => {
    expect(scopeSection(t, 'shared', vi.fn()).selected).toEqual(['shared'])
    expect(scopeSection(t, 'mine', vi.fn()).selected).toEqual(['mine'])
    expect(scopeSection(t, 'public', vi.fn()).selected).toEqual(['public'])
  })

  it('falls back to `all` when the selection is cleared', () => {
    const onChange = vi.fn()
    scopeSection(t, 'shared', onChange).onChange([])
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('passes the chosen slice through', () => {
    const onChange = vi.fn()
    scopeSection(t, 'all', onChange).onChange(['public'])
    expect(onChange).toHaveBeenCalledWith('public')
  })

  it('is single-select — the slices are mutually exclusive server-side', () => {
    expect(scopeSection(t, 'all', vi.fn()).single).toBe(true)
  })

  it('does not offer `all` as an option', () => {
    const values = scopeSection(t, 'all', vi.fn()).options.map((o) => o.value)
    expect(values).toEqual(['mine', 'shared', 'public'])
  })
})
