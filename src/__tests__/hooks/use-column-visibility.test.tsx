import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useColumnVisibility } from '@/hooks/ui/use-column-visibility'

let stored: string[] = []
const setStored = vi.fn((next: string[]) => {
  stored = next
})

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [stored, setStored, true],
}))

describe('useColumnVisibility', () => {
  beforeEach(() => {
    stored = []
    setStored.mockClear()
  })

  it('maps stored hidden ids to a false-valued visibility state', () => {
    stored = ['id', 'createdAt']
    const { result } = renderHook(() =>
      useColumnVisibility('objectColumnsHidden')
    )

    expect(result.current[0]).toEqual({ id: false, createdAt: false })
  })

  it('is empty when nothing is hidden, so every column shows', () => {
    const { result } = renderHook(() =>
      useColumnVisibility('objectColumnsHidden')
    )

    expect(result.current[0]).toEqual({})
  })

  it('stores only the hidden ids, never the visible ones', () => {
    const { result } = renderHook(() =>
      useColumnVisibility('objectColumnsHidden')
    )

    act(() => {
      result.current[1]({ id: false, createdAt: true, cover: true })
    })

    expect(setStored).toHaveBeenCalledWith(['id'])
  })

  it('sorts what it stores, so an unchanged set does not churn the preference', () => {
    const { result } = renderHook(() =>
      useColumnVisibility('objectColumnsHidden')
    )

    act(() => {
      result.current[1]({ id: false, cover: false, createdAt: false })
    })

    expect(setStored).toHaveBeenCalledWith(['cover', 'createdAt', 'id'])
  })

  it('round-trips: hiding then re-showing a column clears it from storage', () => {
    stored = ['id']
    const { result, rerender } = renderHook(() =>
      useColumnVisibility('objectColumnsHidden')
    )

    act(() => {
      result.current[1]({ id: true })
    })
    rerender()

    expect(setStored).toHaveBeenCalledWith([])
  })
})
