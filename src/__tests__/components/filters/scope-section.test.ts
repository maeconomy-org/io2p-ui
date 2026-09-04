import { describe, it, expect, vi } from 'vitest'

import { scopeSection } from '@/components/filters/filter-menu'

const t = (key: string) => key

describe('scopeSection', () => {
  it('shows the active slice as selected, including `all`', () => {
    // Modelled as absence, `all` had no way back except "Clear filters" — which also cleared the
    // Status section — and the menu read as though nothing was chosen.
    expect(scopeSection(t, 'all', vi.fn()).selected).toEqual(['all'])
  })

  it('counts toward the badge only when it differs from the stored default', () => {
    // Otherwise every account carries a permanent 1: the scope is always set to something.
    expect(scopeSection(t, 'all', vi.fn(), 'all').activeWhen).toBe(false)
    expect(scopeSection(t, 'mine', vi.fn(), 'all').activeWhen).toBe(true)
    // A user whose list opens on `mine` has not narrowed anything by seeing `mine`.
    expect(scopeSection(t, 'mine', vi.fn(), 'mine').activeWhen).toBe(false)
    expect(scopeSection(t, 'all', vi.fn(), 'mine').activeWhen).toBe(true)
  })

  it('returns to the stored default when the filters are cleared', () => {
    // This filter has no empty state — the list always asks for some slice.
    const onChange = vi.fn()
    scopeSection(t, 'public', onChange, 'mine').onChange([])
    expect(onChange).toHaveBeenCalledWith('mine')
  })

  it('reflects the active slice', () => {
    expect(scopeSection(t, 'shared', vi.fn()).selected).toEqual(['shared'])
    expect(scopeSection(t, 'mine', vi.fn()).selected).toEqual(['mine'])
    expect(scopeSection(t, 'public', vi.fn()).selected).toEqual(['public'])
  })

  it('falls back to `all` when no default was supplied', () => {
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

  it('names the active slice on the trigger, including the default', () => {
    // The badge cannot say this — counting `all` as active would mark every list as filtered — so
    // the summary is what makes an unselected default legible.
    expect(scopeSection(t, 'all', vi.fn()).summary).toBe('common.scopeAll')
    expect(scopeSection(t, 'mine', vi.fn()).summary).toBe('common.scopeMine')
    expect(scopeSection(t, 'shared', vi.fn()).summary).toBe(
      'common.scopeShared'
    )
  })

  it('offers every slice the list endpoint takes', () => {
    const values = scopeSection(t, 'all', vi.fn()).options.map((o) => o.value)
    expect(values).toEqual(['all', 'mine', 'shared', 'public'])
  })
})
