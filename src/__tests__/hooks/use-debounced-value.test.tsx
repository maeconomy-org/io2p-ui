import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useDebouncedValue } from '@/hooks/ui/use-debounced-value'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('holds the first value until the input has been quiet for 300 ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: '' } }
    )

    for (const value of ['s', 'st', 'ste', 'stee', 'steel']) {
      rerender({ value })
      act(() => vi.advanceTimersByTime(100))
    }
    // 100 ms since the last change.
    expect(result.current).toBe('')

    act(() => vi.advanceTimersByTime(199))
    expect(result.current).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('steel')
  })
})
