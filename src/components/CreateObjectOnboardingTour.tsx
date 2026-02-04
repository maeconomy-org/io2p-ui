'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'

import { useAuth } from '@/contexts'

const ONBOARDING_KEY = 'onboarding:create-object:v1'
const TARGET_SELECTOR = '[data-tour="create-object"]'
const MAX_ATTEMPTS = 10
const ATTEMPT_DELAY_MS = 300

export default function CreateObjectOnboardingTour() {
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

    const startTour = () => {
      if (cancelled) {
        return
      }

      const target = document.querySelector(TARGET_SELECTOR)
      if (!target) {
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
        onDestroyStarted: () => {
          localStorage.setItem(ONBOARDING_KEY, 'done')
        },
        onDestroyed: () => {
          driverRef.current = null
        },
        steps: [
          {
            element: TARGET_SELECTOR,
            popover: {
              title: 'Create your first object',
              description: 'Use this button to add a new object to the system.',
            },
          },
        ],
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
