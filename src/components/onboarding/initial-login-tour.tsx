'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import { useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import { USER_MENU_TOGGLE_EVENT } from '@/components/onboarding/constants'

const ONBOARDING_KEY = 'onboarding:initial-login:v1'
const MAX_ATTEMPTS = 10
const ATTEMPT_DELAY_MS = 300

const NAV_OBJECTS_SELECTOR = '[data-tour="nav-objects"]'
const NAV_PROCESSES_SELECTOR = '[data-tour="nav-processes"]'
const NAV_MODELS_SELECTOR = '[data-tour="nav-models"]'
const NAV_IMPORT_SELECTOR = '[data-tour="nav-import"]'
const SEARCH_BUTTON_SELECTOR = '[data-tour="search-button"]'
const DEMO_TOUR_SELECTOR = '[data-tour="demo-tour"]'
const READY_SELECTORS = [
  NAV_OBJECTS_SELECTOR,
  NAV_PROCESSES_SELECTOR,
  NAV_MODELS_SELECTOR,
  NAV_IMPORT_SELECTOR,
  SEARCH_BUTTON_SELECTOR,
]

type DriverApi = ReturnType<typeof driver>
type DriverHookOptions = { driver?: DriverApi }

const getSteps = (t: ReturnType<typeof useTranslations>) => [
  {
    element: NAV_OBJECTS_SELECTOR,
    popover: {
      title: t('onboarding.initialLogin.welcome'),
      description: t('onboarding.initialLogin.welcomeDescription'),
    },
  },
  {
    element: NAV_PROCESSES_SELECTOR,
    popover: {
      title: t('onboarding.initialLogin.processes'),
      description: t('onboarding.initialLogin.processesDescription'),
    },
  },
  {
    element: NAV_MODELS_SELECTOR,
    popover: {
      title: t('onboarding.initialLogin.models'),
      description: t('onboarding.initialLogin.modelsDescription'),
    },
  },
  {
    element: NAV_IMPORT_SELECTOR,
    popover: {
      title: t('onboarding.initialLogin.import'),
      description: t('onboarding.initialLogin.importDescription'),
      onNextClick: (
        _element: Element | undefined,
        _step: unknown,
        options: DriverHookOptions
      ) => {
        const driverApi = options?.driver
        if (!driverApi) {
          return
        }
        driverApi.moveNext()
      },
    },
  },
  {
    element: SEARCH_BUTTON_SELECTOR,
    popover: {
      title: t('onboarding.initialLogin.search'),
      description: t('onboarding.initialLogin.searchDescription'),
      onNextClick: (
        _element: Element | undefined,
        _step: unknown,
        options: DriverHookOptions
      ) => {
        const driverApi = options?.driver
        if (!driverApi) {
          return
        }

        window.dispatchEvent(
          new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: true } })
        )

        let attempts = 0
        const waitForMenuItem = () => {
          if (document.querySelector(DEMO_TOUR_SELECTOR)) {
            driverApi.moveNext()
            return
          }

          attempts += 1
          if (attempts < MAX_ATTEMPTS) {
            setTimeout(waitForMenuItem, ATTEMPT_DELAY_MS)
          } else {
            driverApi.destroy()
          }
        }

        waitForMenuItem()
      },
    },
  },
  {
    element: DEMO_TOUR_SELECTOR,
    onHighlightStarted: () => {
      window.dispatchEvent(
        new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: true } })
      )
    },
    onDeselected: () => {
      window.dispatchEvent(
        new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
      )
    },
    popover: {
      title: t('onboarding.initialLogin.demoTour'),
      description: t('onboarding.initialLogin.demoTourDescription'),
      onNextClick: (
        _element: Element | undefined,
        _step: unknown,
        options: DriverHookOptions
      ) => {
        localStorage.setItem(ONBOARDING_KEY, 'done')
        window.dispatchEvent(
          new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
        )
        options?.driver?.destroy()
      },
    },
  },
]

export default function InitialLoginTour() {
  const { isAuthenticated, authLoading } = useAuth()
  const t = useTranslations()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (authLoading || !isAuthenticated || hasStartedRef.current) {
      return
    }

    const hasCompleted = localStorage.getItem(ONBOARDING_KEY) === 'done'
    if (hasCompleted) {
      return
    }

    let cancelled = false
    let attempts = 0
    let startTimeout: ReturnType<typeof setTimeout> | null = null

    const allTargetsReady = () =>
      READY_SELECTORS.every((selector) => document.querySelector(selector))

    const startTour = () => {
      if (cancelled) {
        return
      }

      if (!allTargetsReady()) {
        attempts += 1
        if (attempts < MAX_ATTEMPTS) {
          startTimeout = setTimeout(startTour, ATTEMPT_DELAY_MS)
        }
        return
      }

      hasStartedRef.current = true
      const steps = getSteps(t)
      const onboardingDriver = driver({
        nextBtnText: t('common.next'),
        prevBtnText: t('common.previous'),
        showProgress: true,
        allowClose: false,
        allowKeyboardControl: true,
        onCloseClick: () => {
          localStorage.setItem(ONBOARDING_KEY, 'done')
          window.dispatchEvent(
            new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
          )
          onboardingDriver.destroy()
        },
        onDestroyStarted: () => {
          localStorage.setItem(ONBOARDING_KEY, 'done')
          window.dispatchEvent(
            new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
          )
        },
        onDestroyed: () => {
          driverRef.current = null
        },
        steps,
      })

      driverRef.current = onboardingDriver
      onboardingDriver.drive()
    }

    startTimeout = setTimeout(startTour, 0)

    return () => {
      cancelled = true
      if (startTimeout) {
        clearTimeout(startTimeout)
      }
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [authLoading, isAuthenticated])

  return null
}
