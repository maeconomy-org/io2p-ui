'use client'

import { useEffect, useRef } from 'react'
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

      if (pathname !== tour.route) {
        router.push(tour.route)
      }

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
        // An anchor that is not on screen costs one skipped step, not a stall —
        // several steps here live inside a sheet the user may never open.
        skipMissingElement: true,
        waitForElement: ELEMENT_WAIT_MS,
        animate: !prefersReducedMotion(),
        onDestroyed: () => {
          driverRef.current = null
          isStartingRef.current = false
        },
        steps: tour.steps(m),
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
      void startTour(id)
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
  }, [authLoading, isAuthenticated, pathname, router])

  return null
}
