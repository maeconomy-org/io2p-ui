import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useTheme, resetThemeTransition } from '@/hooks/use-theme'

const nativeSetTheme = vi.fn()
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: nativeSetTheme }),
}))

const storeTheme = vi.fn()
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [undefined, storeTheme, true],
}))

/** One started transition, with both promises under the test's control. */
type Fake = {
  run: () => void
  skipReady: (reason: unknown) => void
  finish: () => void
  ready: Promise<void>
  finished: Promise<void>
}

let transitions: Fake[]

function fakeStartViewTransition(callback: () => void): Fake {
  const fake = { run: callback } as Fake
  fake.ready = new Promise<void>((_resolve, reject) => {
    fake.skipReady = reject
  })
  fake.finished = new Promise<void>((resolve) => {
    fake.finish = resolve as () => void
  })
  transitions.push(fake)
  return fake
}

const html = () => document.documentElement
const flush = () => act(async () => {})

beforeEach(() => {
  vi.clearAllMocks()
  resetThemeTransition()
  transitions = []
  html().className = ''
  document.startViewTransition =
    fakeStartViewTransition as unknown as typeof document.startViewTransition
})

afterEach(() => {
  resetThemeTransition()
  Reflect.deleteProperty(document, 'startViewTransition')
})

describe('useTheme', () => {
  it('animates the change and stores it on the account', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))

    expect(transitions).toHaveLength(1)
    expect(html()).toHaveClass('columns-slide-transition')
    expect(storeTheme).toHaveBeenCalledWith('dark')

    // next-themes is called by the browser, inside the transition.
    expect(nativeSetTheme).not.toHaveBeenCalled()
    act(() => transitions[0].run())
    expect(nativeSetTheme).toHaveBeenCalledWith('dark')
  })

  /**
   * The regression. `PreferenceSync` reads the optimistic cache write before
   * the transition callback has told next-themes, so it asks for the same theme
   * again. That second transition used to skip the first one, which rejected
   * `ready` with "AbortError: Transition was skipped".
   */
  it('starts no second transition for the value already in flight', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))
    act(() => result.current.applyTheme('dark'))

    expect(transitions).toHaveLength(1)
  })

  it('allows the same value again once the transition ends', async () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))
    act(() => transitions[0].finish())
    await flush()

    expect(html()).not.toHaveClass('columns-slide-transition')

    act(() => result.current.applyTheme('dark'))
    expect(transitions).toHaveLength(2)
  })

  it('keeps the class until the LAST transition ends', async () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))
    act(() => result.current.setTheme('light'))
    expect(transitions).toHaveLength(2)

    // The first one is skipped by the second, so it settles first.
    act(() => {
      transitions[0].skipReady(
        new DOMException('Transition was skipped', 'AbortError')
      )
      transitions[0].finish()
    })
    await flush()
    expect(html()).toHaveClass('columns-slide-transition')

    act(() => transitions[1].finish())
    await flush()
    expect(html()).not.toHaveClass('columns-slide-transition')
  })

  it('reports no unhandled rejection when a transition is skipped', async () => {
    const rejections: unknown[] = []
    const collect = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', collect)

    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    act(() => {
      transitions[0].skipReady(
        new DOMException('Transition was skipped', 'AbortError')
      )
      transitions[0].finish()
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', collect)

    expect(rejections).toEqual([])
  })

  it('sets the theme directly when the user asks for reduced motion', () => {
    // `Once`: `clearAllMocks` clears calls, not a return value, so a permanent
    // one would follow this test into the next.
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
    } as MediaQueryList)

    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))

    expect(transitions).toHaveLength(0)
    expect(nativeSetTheme).toHaveBeenCalledWith('dark')
    expect(storeTheme).toHaveBeenCalledWith('dark')
  })

  it('sets the theme directly when the browser has no view transitions', () => {
    Reflect.deleteProperty(document, 'startViewTransition')

    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))

    expect(transitions).toHaveLength(0)
    expect(nativeSetTheme).toHaveBeenCalledWith('dark')
  })
})
