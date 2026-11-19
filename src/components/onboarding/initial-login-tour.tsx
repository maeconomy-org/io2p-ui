'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/styles/driver-custom.css'
import { useLocale, useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import { loadTourMessages, tourText, type TourMessages } from './tour-messages'
import { INITIAL_LOGIN_TOUR, useTourSeen } from './use-onboarding'
import { sel } from '@/constants'
import {
  ELEMENT_WAIT_MS,
  NAV_MENU_TOGGLE_EVENT,
  USER_MENU_TOGGLE_EVENT,
  prefersReducedMotion,
} from '@/components/onboarding/constants'

type DriverApi = ReturnType<typeof driver>
type DriverHookOptions = { driver?: DriverApi }

const toggleNavMenu = (key: string, open: boolean) =>
  window.dispatchEvent(
    new CustomEvent(NAV_MENU_TOGGLE_EVENT, { detail: { key, open } })
  )

const toggleUserMenu = (open: boolean) =>
  window.dispatchEvent(
    new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open } })
  )

const getSteps = (m: TourMessages) => [
  {
    element: sel('navObjects'),
    popover: {
      title: tourText(m, 'initialLogin', 'welcome'),
      description: tourText(m, 'initialLogin', 'welcomeDescription'),
    },
  },
  {
    element: sel('navProcesses'),
    popover: {
      title: tourText(m, 'initialLogin', 'processes'),
      description: tourText(m, 'initialLogin', 'processesDescription'),
    },
  },
  {
    // `/shares` took the slot `/groups` held, and is a genuinely new concept
    // rather than a rename — an unexplained new noun in the primary nav was the
    // largest comprehension gap left by the refactor.
    element: sel('navShares'),
    popover: {
      title: tourText(m, 'initialLogin', 'shares'),
      description: tourText(m, 'initialLogin', 'sharesDescription'),
    },
  },
  {
    // Points at the Library TRIGGER, so open the menu while it is highlighted —
    // otherwise the step can only ever describe the word "Library" and never
    // reveals Formulas or Constants.
    element: sel('navLibrary'),
    onHighlightStarted: () => toggleNavMenu('library', true),
    onDeselected: () => toggleNavMenu('library', false),
    popover: {
      title: tourText(m, 'initialLogin', 'library'),
      description: tourText(m, 'initialLogin', 'libraryDescription'),
    },
  },
  {
    element: sel('navImport'),
    popover: {
      title: tourText(m, 'initialLogin', 'import'),
      description: tourText(m, 'initialLogin', 'importDescription'),
    },
  },
  {
    element: sel('searchButton'),
    popover: {
      title: tourText(m, 'initialLogin', 'search'),
      description: tourText(m, 'initialLogin', 'searchDescription'),
      // The next step lives inside the profile dropdown, so open it on the way
      // out. Waiting for it to render is `waitForElement`'s job now, not a
      // hand-rolled poll's.
      onNextClick: (
        _element: Element | undefined,
        _step: unknown,
        options: DriverHookOptions
      ) => {
        toggleUserMenu(true)
        options?.driver?.moveNext()
      },
    },
  },
  {
    element: sel('demoTour'),
    // Re-asserts the open state so stepping backwards onto this step works too.
    onHighlightStarted: () => toggleUserMenu(true),
    onDeselected: () => toggleUserMenu(false),
    popover: {
      title: tourText(m, 'initialLogin', 'demoTour'),
      description: tourText(m, 'initialLogin', 'demoTourDescription'),
    },
  },
]

export default function InitialLoginTour() {
  const { isAuthenticated, authLoading } = useAuth()
  const t = useTranslations()
  const locale = useLocale()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const hasStartedRef = useRef(false)
  const { seen, markSeen, resolved } = useTourSeen(INITIAL_LOGIN_TOUR)

  // `markSeen` changes identity as the stored list changes, but the driver
  // config below is built once inside an effect. A ref keeps the teardown hook
  // calling the current one instead of the one captured at construction.
  const markSeenRef = useRef(markSeen)
  useEffect(() => {
    markSeenRef.current = markSeen
  }, [markSeen])

  useEffect(() => {
    // `resolved` gates on the `/me` payload having ARRIVED, not merely on auth
    // settling: the seen-flag lives in an account-scoped blob with no cookie
    // hint, so before it lands `seen` is false for everyone.
    if (
      authLoading ||
      !isAuthenticated ||
      !resolved ||
      seen ||
      hasStartedRef.current
    ) {
      return
    }

    let cancelled = false

    const startTour = async () => {
      // Tour copy is fetched here rather than bundled with the page — see
      // tour-messages. One await before driver() starts; nothing is on screen yet.
      const steps = getSteps(await loadTourMessages(locale))
      // Marked only once the attempt survives the await. Set before it, a
      // dependency change during the fetch cancels this run while leaving the
      // guard latched, and the tour never runs again for this mount.
      if (cancelled) return
      hasStartedRef.current = true

      const onboardingDriver = driver({
        nextBtnText: t('common.next'),
        prevBtnText: t('common.previous'),
        showProgress: true,
        allowClose: true,
        allowKeyboardControl: true,
        // Deliberately false. The last step points inside the profile dropdown,
        // which Radix unmounts while closed — and driver.js judges skippability
        // against the DOM as it currently stands, so with this on it decided
        // there was no step after Search and rendered "Done" one step early.
        // `waitForElement` covers the gap instead: the menu opens on the way out
        // of Search, and the step waits for it.
        skipMissingElement: false,
        waitForElement: ELEMENT_WAIT_MS,
        animate: !prefersReducedMotion(),
        // The single exit path: finishing, closing, and ESC all land here.
        // driver.js hands control over rather than destroying itself, so this
        // hook owns calling destroy().
        onDestroyStarted: () => {
          markSeenRef.current()
          // Leaving mid-tour must not strand a menu the tour forced open.
          toggleUserMenu(false)
          toggleNavMenu('library', false)
          onboardingDriver.destroy()
        },
        onDestroyed: () => {
          driverRef.current = null
        },
        steps,
      })

      driverRef.current = onboardingDriver
      onboardingDriver.drive()
    }

    void startTour()

    return () => {
      cancelled = true
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
    // `locale` and `t` are deliberately omitted. The tour runs at most once per
    // account (guarded by hasStartedRef and the stored `toursSeen` list), and
    // restarting it because the user switched language mid-tour would be worse
    // than finishing in the language it began in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, resolved, seen])

  return null
}
