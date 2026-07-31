import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'

import { TOUR_START_EVENT } from '@/components/onboarding/constants'
import { INITIAL_LOGIN_TOUR } from '@/components/onboarding/use-onboarding'
import { ONBOARDING_EPOCH } from '@/constants'
import { keyFor } from '@/hooks/ui/use-preference'

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

vi.mock('next/navigation', () => ({
  usePathname: () => '/objects',
  useRouter: () => ({ push: vi.fn() }),
}))

const USER = 'user-uuid'
const authState = {
  isAuthenticated: true,
  authLoading: false,
  userId: USER as string | undefined,
}
vi.mock('@/contexts', () => ({ useAuth: () => authState }))
// `usePreference` reaches for the module directly rather than the barrel, so it
// needs its own mock or the real provider tree comes with it.
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => authState }))

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
    setReducedMotion(false)
    authState.isAuthenticated = true
    authState.authLoading = false
  })

  const startTour = async () => {
    const { default: TourRunner } =
      await import('@/components/onboarding/tour-runner')
    render(<TourRunner />)
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(TOUR_START_EVENT, { detail: { id: 'create-object' } })
      )
    })
  }

  it('stays escapable so a missing anchor cannot lock the page', async () => {
    await startTour()

    expect(driverMock).toHaveBeenCalledTimes(1)
    expect(lastConfig().allowClose).toBe(true)
  })

  it('skips anchors that no longer exist instead of stalling on them', async () => {
    await startTour()

    expect(lastConfig().skipMissingElement).toBe(true)
    // A finite wait, so a dead anchor times out rather than polling forever.
    expect(lastConfig().waitForElement).toBeGreaterThan(0)
  })

  it('advances on click rather than hand-rolled click-and-poll glue', async () => {
    await startTour()

    const steps = lastConfig().steps as Array<{
      popover?: { onNextClick?: unknown }
    }>
    expect(lastConfig().advanceOnClick).toBe(true)
    expect(steps.every((s) => s.popover?.onNextClick === undefined)).toBe(true)
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
})

describe('InitialLoginTour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setReducedMotion(false)
    localStorage.clear()
    authState.isAuthenticated = true
    authState.authLoading = false
    authState.userId = USER
  })

  afterEach(() => {
    localStorage.clear()
  })

  const blob = () =>
    JSON.parse(localStorage.getItem(keyFor(USER)) ?? '{}') as Record<
      string,
      unknown
    >

  const markSeenInStorage = (uuid = USER, epoch = ONBOARDING_EPOCH) =>
    localStorage.setItem(
      keyFor(uuid),
      JSON.stringify({
        toursSeen: [INITIAL_LOGIN_TOUR],
        onboardingEpoch: epoch,
      })
    )

  const mount = async () => {
    const { default: InitialLoginTour } =
      await import('@/components/onboarding/initial-login-tour')
    await act(async () => {
      render(<InitialLoginTour />)
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
    expect(blob().toursSeen).toEqual([INITIAL_LOGIN_TOUR])
  })

  it('does not run again once the tour has been seen', async () => {
    markSeenInStorage()

    await mount()

    expect(driverMock).not.toHaveBeenCalled()
  })

  it('keeps the seen flag scoped to the account that set it', async () => {
    // The bare localStorage key this replaced was machine-wide, so on a shared
    // login whoever finished first silenced the tour for everyone after them.
    markSeenInStorage('someone-else')

    await mount()

    expect(driverMock).toHaveBeenCalledTimes(1)
  })

  it('re-runs for an account whose stored epoch predates the current one', async () => {
    markSeenInStorage(USER, ONBOARDING_EPOCH - 1)

    await mount()

    expect(driverMock).toHaveBeenCalledTimes(1)
  })

  it('leaves unrelated view preferences alone when re-onboarding', async () => {
    localStorage.setItem(
      keyFor(USER),
      JSON.stringify({
        objectsView: 'columns',
        toursSeen: [INITIAL_LOGIN_TOUR],
        onboardingEpoch: ONBOARDING_EPOCH - 1,
      })
    )

    await mount()
    await act(async () => (lastConfig().onDestroyStarted as () => void)())

    // The epoch exists precisely so re-onboarding does not cost people their
    // saved views the way bumping PREFERENCES_VERSION would.
    expect(blob().objectsView).toBe('columns')
    expect(blob().onboardingEpoch).toBe(ONBOARDING_EPOCH)
  })

  it('skips missing anchors so the mobile nav cannot poll forever', async () => {
    await mount()

    expect(lastConfig().skipMissingElement).toBe(true)
    expect(lastConfig().allowClose).toBe(true)
  })
})
