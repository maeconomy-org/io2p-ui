// `usePreference` returns its seed until /me lands, so reading it as initial state would pin every
// account to the fallback. This hook adopts the stored value when it resolves, once.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let preference: [string, unknown, boolean] = ['all', vi.fn(), false]
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => preference,
}))

import { useScopePreference } from '@/hooks/ui/use-scope-preference'

describe('useScopePreference', () => {
  beforeEach(() => {
    preference = ['all', vi.fn(), false]
  })

  it('holds the fallback while the account record is still loading', () => {
    const { result } = renderHook(() => useScopePreference('objectsScope'))
    expect(result.current[0]).toBe('all')
  })

  it('takes the stored value once it resolves', () => {
    const { result, rerender } = renderHook(() =>
      useScopePreference('objectsScope')
    )
    expect(result.current[0]).toBe('all')

    preference = ['mine', vi.fn(), true]
    rerender()

    expect(result.current[0]).toBe('mine')
  })

  it('does not overwrite a choice the user made for this visit', () => {
    preference = ['mine', vi.fn(), true]
    const { result, rerender } = renderHook(() =>
      useScopePreference('objectsScope')
    )

    act(() => result.current[1]('public'))
    expect(result.current[0]).toBe('public')

    // A refetch hands the same preference back; the excursion has to survive it.
    rerender()
    expect(result.current[0]).toBe('public')
  })
})
