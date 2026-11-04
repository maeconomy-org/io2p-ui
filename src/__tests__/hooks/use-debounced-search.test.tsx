import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useDebouncedSearch } from '@/hooks/ui/use-debounced-search'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const render = () =>
  renderHook(({ raw }) => useDebouncedSearch(raw), {
    initialProps: { raw: '' },
  })

describe('useDebouncedSearch', () => {
  it('sends no q for one typed letter', () => {
    const { result, rerender } = render()
    rerender({ raw: 'a' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBeUndefined()
  })

  it('sends the trimmed text from two letters, once typing stops', () => {
    const { result, rerender } = render()
    rerender({ raw: ' ab ' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBeUndefined()
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('ab')
  })

  it('drops q again when the text is cut back to one letter', () => {
    const { result, rerender } = render()
    rerender({ raw: 'ab' })
    act(() => vi.advanceTimersByTime(300))
    rerender({ raw: 'a' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBeUndefined()
  })
})
