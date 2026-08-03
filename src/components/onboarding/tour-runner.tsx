'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/styles/driver-custom.css'
import { useLocale, useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import {
  ELEMENT_WAIT_MS,
  TOUR_START_EVENT,
  USER_MENU_TOGGLE_EVENT,
  prefersReducedMotion,
} from '@/components/onboarding/constants'
import { loadTourMessages } from './tour-messages'
import { getTour, type TourId } from './tour-registry'
import { runTourAction } from './use-tour-action'

/**
 * The one component that runs an opt-in walkthrough.
 *
 * Was `demo-tour.tsx`, which hard-coded a single tour's eleven steps inline. The
 * steps now come from the registry, so adding a walkthrough is a data change and
 * this file stays fixed.
 */
export default function TourRunner() {
  const { isAuthenticated, authLoading } = useAuth()
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const isStartingRef = useRef(false)

  // A tour asked for from another page. `router.push` does not block, so driving
  // straight after it ran the tour against the page the user was LEAVING — every
  // anchor missing, every step skipped, and the tour ended before the new route
  // painted. Nothing appeared to happen. Park the request instead and let the
  // effect pick it up once `pathname` actually reports the destination.
  const [pending, setPending] = useState<TourId | null>(null)
  // Which parked request we have already acted on. Clearing `pending` instead
  // would re-run the effect mid-launch, and its cleanup sets the `cancelled`
  // flag that `startTour` checks after awaiting its copy — so the tour would
  // cancel itself before it ever built a driver.
  const launchedRef = useRef<TourId | null>(null)

  useEffect(() => {
    if (authLoading) {
      return
    }

    // Guards the await below: if the effect tears down while the tour copy is
    // still loading, do not open a tour over a page that has moved on.
    let cancelled = false

    const startTour = async (id: TourId) => {
      const tour = getTour(id)
      if (!tour) return

      const m = await loadTourMessages(locale)
      if (cancelled) return

      if (!isAuthenticated || isStartingRef.current) {
        return
      }

      isStartingRef.current = true
      window.dispatchEvent(
        new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
      )

      const driverObj = driver({
        nextBtnText: t('common.next'),
        prevBtnText: t('common.previous'),
        showProgress: true,
        // Every step must stay escapable. With allowClose false driver.js omits
        // the close button AND gates the ESC and overlay-click handlers on the
        // same flag, so one unreachable step used to leave a page reload as the
        // only way out.
        allowClose: true,
        allowKeyboardControl: true,
        // Clicking the highlighted element advances, which is what removed the
        // onNextClick -> .click() -> poll -> moveNext() glue that caused the lock.
        advanceOnClick: true,
        // NOT set globally. driver.js decides skippability against the DOM as it
        // stands, so every step living inside a sheet that has not been opened
        // yet counts as missing — the tour prunes itself down to step one and
        // renders "Done" instead of "Next". Steps that may genuinely have no
        // target opt in per-step via `optional`; the rest wait, bounded by
        // `waitForElement`.
        skipMissingElement: false,
        waitForElement: ELEMENT_WAIT_MS,
        animate: !prefersReducedMotion(),
        onDestroyed: () => {
          driverRef.current = null
          isStartingRef.current = false
          // Released only once the tour is over, so the same walkthrough can be
          // started again from the menu.
          launchedRef.current = null
          setPending(null)
        },
        steps: tour.steps(m).map(({ action, ...step }) => {
          return action
            ? {
                ...step,
                popover: {
                  ...step.popover,
                  // Next asks the page to open what the following steps live
                  // inside. `waitForElement` then covers the render.
                  onNextClick: () => {
                    runTourAction(action)
                    driverObj.moveNext()
                  },
                },
              }
            : step
        }),
      })

      driverRef.current = driverObj
      driverObj.drive()
    }

    const handleStart = (event: Event) => {
      const id = (event as CustomEvent<{ id?: TourId }>).detail?.id
      if (!id) return
      if (driverRef.current) {
        driverRef.current.destroy()
      }
      setPending(id)
    }

    // A parked request runs as soon as we are on its route, and navigates there
    // first if we are not. `pathname` is in the deps, so arriving re-runs this.
    if (pending && launchedRef.current !== pending) {
      const tour = getTour(pending)
      if (!tour) {
        // An id with no registry entry: mark it handled so this stops being
        // re-evaluated, rather than clearing state from inside the effect.
        launchedRef.current = pending
      } else if (pathname === tour.route) {
        launchedRef.current = pending
        void startTour(pending)
      } else {
        router.push(tour.route)
      }
    }

    window.addEventListener(TOUR_START_EVENT, handleStart)

    return () => {
      cancelled = true
      window.removeEventListener(TOUR_START_EVENT, handleStart)
    }
    // `locale` and `t` omitted deliberately: both are read only inside
    // startTour, which runs on an explicit user action, and re-registering the
    // listener on a language change would tear down a tour mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, pathname, router, pending])

  return null
}
