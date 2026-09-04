import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'

import { TOUR_START_EVENT } from '@/components/onboarding/constants'
import { INITIAL_LOGIN_TOUR } from '@/components/onboarding/use-onboarding'
import { ONBOARDING_EPOCH } from '@/constants'
import { queryKeys } from '@/lib/query-keys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Regression coverage for the tour lock.
 *
 * The demo tour used to ship `allowClose: false` alongside steps whose anchors
 * had been deleted by the refactor. driver.js gates the close button, the ESC
 * key and the overlay click on that one flag, so an unreachable step left a page
 * reload as the only escape. These assertions pin the config that makes a
 * missing anchor survivable — they are cheap, and they fail loudly if anyone
 * flips `allowClose` back or drops `skipMissingElement`.
 */

type DriverConfig = Record<string, unknown>

const driveMock = vi.fn()
const destroyMock = vi.fn()
const driverMock = vi.fn((config: DriverConfig) => ({
  drive: driveMock,
  // Mirrors driver.js: destroying fires `onDestroyed`, which is what lets the
  // component drop its ref. Without it the effect cleanup would destroy a second
  // time and the test would be asserting against a driver that does not exist.
  destroy: () => {
    destroyMock()
    ;(config.onDestroyed as (() => void) | undefined)?.()
  },
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
}))

vi.mock('driver.js', () => ({
  driver: (config: DriverConfig) => driverMock(config),
}))
vi.mock('driver.js/dist/driver.css', () => ({}))
vi.mock('@/styles/driver-custom.css', () => ({}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

let pathname = '/objects'
const push = vi.fn((to: string) => {
  pathname = to
})
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}))

const USER = 'user-uuid'
const authState: {
  isAuthenticated: boolean
  authLoading: boolean
  userId?: string
  preferences?: Record<string, Record<string, unknown>>
} = {
  isAuthenticated: true,
  authLoading: false,
  userId: USER,
  preferences: undefined,
}
vi.mock('@/contexts', () => ({ useAuth: () => authState }))
// `usePreference` reaches for the module directly rather than the barrel, so it
// needs its own mock or the real provider tree comes with it.
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

vi.mock('@/components/onboarding/tour-messages', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/onboarding/tour-messages')
  >('@/components/onboarding/tour-messages')
  return { ...actual, loadTourMessages: async () => ({}) }
})

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

/** The config object the component handed to `driver()`. */
const lastConfig = (): DriverConfig => driverMock.mock.calls.at(-1)?.[0] ?? {}

describe('TourRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname = '/objects'
    setReducedMotion(false)
    authState.isAuthenticated = true
    authState.authLoading = false
    updatePreferences.mockResolvedValue({})
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  const startTour = async (id = 'create-object') => {
    const { default: TourRunner } =
      await import('@/components/onboarding/tour-runner')
    render(<TourRunner />, { wrapper })
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(TOUR_START_EVENT, { detail: { id } })
      )
    })
    // The request is parked in state first so it can survive a route change, so
    // driving happens on the NEXT render rather than inside the dispatch.
    await act(async () => {})
  }

  it('stays escapable so a missing anchor cannot lock the page', async () => {
    await startTour()

    expect(driverMock).toHaveBeenCalledTimes(1)
    expect(lastConfig().allowClose).toBe(true)
  })

  it('does not prune gated steps before the tour starts', async () => {
    await startTour()

    // driver.js judges skippability against the DOM as it stands. Set globally,
    // every step inside an unopened sheet counts as missing, the tour collapses
    // to its first step and renders "Done" instead of "Next".
    expect(lastConfig().skipMissingElement).toBe(false)
    // A finite wait instead, so a step that never appears times out rather than
    // hanging the tour.
    expect(lastConfig().waitForElement).toBeGreaterThan(0)
  })

  it('only targets things a tour can actually reach', async () => {
    const { TOURS } = await import('@/components/onboarding/tour-registry')
    // work-with-drafts used to end on the pinned-drafts row, which does not
    // exist until a draft has been saved — that is, after the tour is over. It
    // rendered "Done" on step 2 of 3 and read as stuck.
    const drafts = TOURS.find((tour) => tour.id === 'work-with-drafts')
    expect(drafts?.steps({} as never)).toHaveLength(2)
  })

  it('advances on click rather than hand-rolled click-and-poll glue', async () => {
    await startTour()

    const steps = lastConfig().steps as Array<{
      popover?: { onNextClick?: unknown }
    }>
    expect(lastConfig().advanceOnClick).toBe(true)
    // Exactly one step keeps a handler: the Create button, which has to be
    // clicked for the sheet the remaining steps live in to exist at all.
    const gated = steps.filter((s) => s.popover?.onNextClick !== undefined)
    expect(gated).toHaveLength(1)
  })

  /**
   * run-import stages a sample sheet inside the wizard, one button short of
   * being written. It has to come back on EVERY exit — driver.js routes Done,
   * Escape, the X and an overlay click through this one callback, so hooking it
   * here is what makes "however it ended" true rather than "if they pressed
   * Done".
   */
  it('takes back what a tour staged, on every way out', async () => {
    const { TOUR_ACTION_EVENT } =
      await import('@/components/onboarding/constants')
    const seen: string[] = []
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail
      if (detail?.action) seen.push(detail.action)
    }
    window.addEventListener(TOUR_ACTION_EVENT, listener)

    pathname = '/import'
    await startTour('run-import')
    await act(async () => {
      ;(lastConfig().onDestroyed as () => void)()
    })

    window.removeEventListener(TOUR_ACTION_EVENT, listener)
    expect(seen).toContain('import.reset')
  })

  it('leaves a tour that staged nothing alone when it ends', async () => {
    const { TOUR_ACTION_EVENT } =
      await import('@/components/onboarding/constants')
    const seen: string[] = []
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail
      if (detail?.action) seen.push(detail.action)
    }
    window.addEventListener(TOUR_ACTION_EVENT, listener)

    // Ending create-object on the Submit button must LEAVE the sheet open —
    // filling it in is the next thing the user does.
    await startTour()
    await act(async () => {
      ;(lastConfig().onDestroyed as () => void)()
    })

    window.removeEventListener(TOUR_ACTION_EVENT, listener)
    expect(seen).toEqual([])
  })

  /**
   * The generic close is right for a gate that opened a sheet, and wrong for one
   * that changed the page some other way. run-import accepts a HIERARCHY at one
   * of its gates; closing a sheet would not take that back, and the step behind
   * it points at a box that only exists while no hierarchy is set.
   */
  it('reverses a gate with its own undo rather than the generic close', async () => {
    pathname = '/import'
    await startTour('run-import')

    const steps = lastConfig().steps as Array<{
      element: string
      popover?: { onPrevClick?: () => void }
    }>
    const { TOUR_ACTION_EVENT } =
      await import('@/components/onboarding/constants')
    const seen: string[] = []
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail
      if (detail?.action) seen.push(detail.action)
    }
    window.addEventListener(TOUR_ACTION_EVENT, listener)

    // The step after the one that accepts the hierarchy.
    const index = steps.findIndex((s) => s.element.includes('level-bar'))
    expect(index).toBeGreaterThan(0)
    steps[index]?.popover?.onPrevClick?.()

    window.removeEventListener(TOUR_ACTION_EVENT, listener)
    expect(seen).toEqual(['import.clearLevels'])
  })

  it('still falls back to closing a sheet when a gate declares no undo', async () => {
    await startTour()

    const steps = lastConfig().steps as Array<{
      popover?: { onPrevClick?: () => void }
    }>
    const { TOUR_ACTION_EVENT } =
      await import('@/components/onboarding/constants')
    const seen: string[] = []
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail
      if (detail?.action) seen.push(detail.action)
    }
    window.addEventListener(TOUR_ACTION_EVENT, listener)

    const withPrev = steps.filter((s) => s.popover?.onPrevClick)
    expect(withPrev).toHaveLength(1)
    withPrev[0]?.popover?.onPrevClick?.()

    window.removeEventListener(TOUR_ACTION_EVENT, listener)
    expect(seen).toEqual(['sheet.close'])
  })

  it('disables animation when the user prefers reduced motion', async () => {
    setReducedMotion(true)
    await startTour()

    expect(lastConfig().animate).toBe(false)
  })

  it('drives the tour once the driver is built', async () => {
    await startTour()

    expect(driveMock).toHaveBeenCalledTimes(1)
  })

  it('asks the page to open the sheet rather than faking a click', async () => {
    // Synthesising DOM events meant depending on how each trigger happens to be
    // built — a Radix dropdown trigger has no click handler at all, so the
    // build-a-template sheet never opened. The page owns the opener; the tour
    // just asks for it.
    const { TOUR_ACTION_EVENT } =
      await import('@/components/onboarding/constants')
    await startTour()

    const heard: string[] = []
    const listener = (event: Event) =>
      heard.push((event as CustomEvent<{ action: string }>).detail.action)
    window.addEventListener(TOUR_ACTION_EVENT, listener)

    const steps = lastConfig().steps as Array<{
      popover?: { onNextClick?: () => void }
    }>
    steps.find((s) => s.popover?.onNextClick)?.popover?.onNextClick?.()

    expect(heard).toEqual(['objects.create'])
    window.removeEventListener(TOUR_ACTION_EVENT, listener)
  })

  it('navigates first when the tour belongs to another page', async () => {
    // `router.push` does not block, so driving immediately ran the tour against
    // the page being left — every anchor missing, every step skipped, and
    // nothing visibly happened.
    const { default: TourRunner } =
      await import('@/components/onboarding/tour-runner')
    const { rerender } = render(<TourRunner />, { wrapper })

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(TOUR_START_EVENT, { detail: { id: 'build-template' } })
      )
    })
    await act(async () => {})

    expect(push).toHaveBeenCalledWith('/templates')
    expect(driverMock).not.toHaveBeenCalled()

    // Arriving on the route is what releases the parked request.
    await act(async () => {
      rerender(<TourRunner />)
    })
    await act(async () => {})

    expect(driverMock).toHaveBeenCalledTimes(1)
  })
})

describe('InitialLoginTour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setReducedMotion(false)
    authState.isAuthenticated = true
    authState.authLoading = false
    authState.userId = USER
    // An account whose preferences HAVE loaded and carry no tour state. `undefined` is the
    // in-flight state, where the tour must not start — see the first-login case below.
    authState.preferences = {}
    updatePreferences.mockResolvedValue({})
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(queryKeys.users.current, {
      id: USER,
      identities: [],
      preferences: {},
    })
  })

  const markSeen = (epoch = ONBOARDING_EPOCH) => {
    authState.preferences = {
      onboarding: { toursSeen: [INITIAL_LOGIN_TOUR], onboardingEpoch: epoch },
    }
  }

  const mount = async () => {
    const { default: InitialLoginTour } =
      await import('@/components/onboarding/initial-login-tour')
    await act(async () => {
      render(<InitialLoginTour />, { wrapper })
    })
  }

  it('records the tour as seen and destroys on the way out', async () => {
    await mount()

    const onDestroyStarted = lastConfig().onDestroyStarted as () => void
    expect(onDestroyStarted).toBeTypeOf('function')

    await act(async () => onDestroyStarted())

    // driver.js hands control to this hook instead of destroying itself, so the
    // hook owning destroy() is what stops the close button from doing nothing.
    expect(destroyMock).toHaveBeenCalledTimes(1)
    // Written to the account on the node, not to this browser.
    expect(updatePreferences).toHaveBeenCalledWith({
      onboarding: { toursSeen: [INITIAL_LOGIN_TOUR] },
    })
  })

  it('does not run again once the tour has been seen', async () => {
    markSeen()

    await mount()

    expect(driverMock).not.toHaveBeenCalled()
  })

  it('runs for an account whose record carries no seen-flag', async () => {
    // The flag now travels with the account rather than the browser, so a
    // different person on the same machine still gets the tour.
    authState.preferences = { onboarding: {} }

    await mount()

    expect(driverMock).toHaveBeenCalledTimes(1)
  })

  it('re-runs for an account whose stored epoch predates the current one', async () => {
    markSeen(ONBOARDING_EPOCH - 1)

    await mount()

    expect(driverMock).toHaveBeenCalledTimes(1)
  })

  it('touches only onboarding keys when re-onboarding', async () => {
    authState.preferences = {
      ui: { objectsView: 'columns' },
      onboarding: {
        toursSeen: [INITIAL_LOGIN_TOUR],
        onboardingEpoch: ONBOARDING_EPOCH - 1,
      },
    }

    await mount()
    await act(async () => (lastConfig().onDestroyStarted as () => void)())

    // A merge patch of the onboarding namespace only — re-onboarding must not
    // cost anyone their saved views.
    for (const call of updatePreferences.mock.calls) {
      expect(Object.keys(call[0])).toEqual(['onboarding'])
    }
  })

  it('keeps the step inside the closed profile menu in the tour', async () => {
    await mount()

    // With skipMissingElement on, the final step — which Radix has not mounted
    // yet — was judged missing and the tour ended one step early.
    expect(lastConfig().skipMissingElement).toBe(false)
    expect(lastConfig().allowClose).toBe(true)
  })

  it('waits for the record before deciding the tour has not been seen', async () => {
    authState.preferences = undefined

    await mount()

    expect(driverMock).not.toHaveBeenCalled()
  })

  it('starts on first login, once the record arrives after auth settles', async () => {
    // The reported bug: `/me` resolves one commit AFTER authLoading clears, and the tour was
    // starting against the defaults, being cancelled by the resulting dependency change, and
    // latching itself off for the rest of the mount. It only appeared on a second reload,
    // where React Query already held `/me`.
    authState.preferences = undefined
    const { default: InitialLoginTour } =
      await import('@/components/onboarding/initial-login-tour')
    let rendered: ReturnType<typeof render>
    await act(async () => {
      rendered = render(<InitialLoginTour />, { wrapper })
    })
    expect(driverMock).not.toHaveBeenCalled()

    authState.preferences = { onboarding: {} }
    await act(async () => {
      rendered.rerender(<InitialLoginTour />)
    })

    expect(driverMock).toHaveBeenCalledTimes(1)
  })
})
