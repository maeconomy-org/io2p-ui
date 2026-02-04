'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'

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

const steps = [
  {
    element: NAV_OBJECTS_SELECTOR,
    popover: {
      title: 'Welcome to IoM - Objects',
      description:
        'This is your main workspace where you can browse, manage, and organize all the objects in your system. Objects are the core entities that represent real-world items, documents, or concepts you want to track and manage.',
    },
  },
  {
    element: NAV_PROCESSES_SELECTOR,
    popover: {
      title: 'I/O Processes',
      description:
        'Here you can track and monitor processes that transform or move your objects. This section helps you understand how objects flow through different stages, from input to output, giving you complete visibility into your operational workflows.',
    },
  },
  {
    element: NAV_MODELS_SELECTOR,
    popover: {
      title: 'Models & Templates',
      description:
        'Create reusable models and templates that define the structure and properties of your objects. Models act as blueprints, ensuring consistency when creating new objects and helping standardize your data across the platform.',
    },
  },
  {
    element: NAV_IMPORT_SELECTOR,
    popover: {
      title: 'Data Import',
      description:
        'Import existing data from external sources, spreadsheets, or other systems. This powerful feature allows you to bring your legacy data into IoM efficiently, supporting various formats and bulk operations to get you started quickly.',
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
      title: 'Global Search',
      description:
        'Use the powerful search functionality to quickly find any object, process, or data across your entire IoM workspace. Press Cmd+K (or Ctrl+K) to open the command center and search through everything with intelligent filtering and suggestions.',
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
      title: 'Interactive Demo Tour',
      description:
        'Ready for a hands-on experience? Click "Demo tour" anytime to take a comprehensive walkthrough that will guide you through creating your first object, exploring all the features, and understanding how everything works together.',
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
      const onboardingDriver = driver({
        allowClose: true,
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
