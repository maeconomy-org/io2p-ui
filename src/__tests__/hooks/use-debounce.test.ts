import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/ui/use-debounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce function calls', () => {
    const callback = vi.fn()

    const { result } = renderHook(() => useDebounce(callback, 300))

    act(() => {
      result.current('arg1')
      result.current('arg2')
      result.current('arg3')
    })

    // Function should not be called immediately
    expect(callback).not.toHaveBeenCalled()

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Should only be called once with the last arguments
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('arg3')
  })

  it('should call function after delay', () => {
    const callback = vi.fn()

    const { result } = renderHook(() => useDebounce(callback, 500))

    act(() => {
      result.current('test')
    })

    // Not called before delay
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(callback).not.toHaveBeenCalled()

    // Called after delay
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(callback).toHaveBeenCalledWith('test')
  })

  it('should reset timer on subsequent calls', () => {
    const callback = vi.fn()

    const { result } = renderHook(() => useDebounce(callback, 300))

    act(() => {
      result.current('first')
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Call again before timer completes
    act(() => {
      result.current('second')
    })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Should not have been called yet (timer was reset)
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Now it should be called with the second argument
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('second')
  })

  it('should handle multiple arguments', () => {
    const callback = vi.fn()

    const { result } = renderHook(() => useDebounce(callback, 100))

    act(() => {
      result.current('arg1', 'arg2', 123)
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123)
  })

  it('should maintain stable reference across renders', () => {
    const callback = vi.fn()

    const { result, rerender } = renderHook(
      ({ fn, delay }) => useDebounce(fn, delay),
      { initialProps: { fn: callback, delay: 300 } }
    )

    const firstRef = result.current

    rerender({ fn: callback, delay: 300 })

    const secondRef = result.current

    // Reference should be stable when deps don't change
    expect(firstRef).toBe(secondRef)
  })
})
