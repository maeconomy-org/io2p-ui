'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { Hints } from 'driver.js/hints'

import { useAuth } from '@/contexts'
import { sel } from '@/constants'
import { prefersReducedMotion } from './constants'
import { loadTourMessages, tourText } from './tour-messages'
import { useHintsDismissed } from './use-onboarding'

/**
 * Non-blocking beacons on what the refactor moved.
 *
 * Both tours are *events*: they fire once, for someone who happened to be new on
 * the day they ran. Existing users get nothing — they log in to find Groups gone
 * and Library new, with their seen-flag already set. A tour is also the wrong
 * shape for that job: they do not need re-orienting, they need three things
 * pointed at.
 *
 * Hints leave the page interactive and are dismissed individually, so ignoring
 * them costs nothing.
 */
const HINTS = [
  { id: 'shares', anchor: 'navShares' },
  { id: 'library', anchor: 'navLibrary' },
] as const

export default function WhatsNewHints() {
  const { isAuthenticated, authLoading } = useAuth()
  const locale = useLocale()
  const pathname = usePathname()
  const { dismissed, dismiss, resolved } = useHintsDismissed()
  const hintsRef = useRef<Hints | null>(null)

  // `dismiss` changes identity as the stored list grows; the driver.js callback
  // is registered once, so it reads the current one through a ref.
  const dismissRef = useRef(dismiss)
  useEffect(() => {
    dismissRef.current = dismiss
  }, [dismiss])

  useEffect(() => {
    if (authLoading || !isAuthenticated || !resolved) return

    const pending = HINTS.filter((hint) => !dismissed.includes(hint.id))
    if (pending.length === 0) return

    let cancelled = false

    const show = async () => {
      const [{ hints }, m] = await Promise.all([
        import('driver.js/hints'),
        loadTourMessages(locale),
      ])
      if (cancelled) return
      await import('driver.js/dist/hints.css')
      if (cancelled) return

      const instance = hints({
        beacon: { animate: !prefersReducedMotion() },
        buttonText: tourText(m, 'whatsNew', 'gotIt'),
        hints: pending.map((hint) => ({
          id: hint.id,
          element: sel(hint.anchor),
          popover: {
            title: tourText(m, 'whatsNew', hint.id),
            description: tourText(m, 'whatsNew', `${hint.id}Description`),
            showButton: true,
          },
          // Dismissal is per hint and persisted, so acknowledging Shares does
          // not silently swallow the Library one.
          onDismiss: () => dismissRef.current(hint.id),
        })),
      })

      hintsRef.current = instance
      instance.show()
    }

    void show()

    return () => {
      cancelled = true
      hintsRef.current?.hide()
      hintsRef.current = null
    }
    // Re-runs on navigation so a beacon lands once its anchor is on screen; the
    // pending check above keeps that from re-showing something already dismissed.
  }, [authLoading, isAuthenticated, resolved, dismissed, locale, pathname])

  return null
}
