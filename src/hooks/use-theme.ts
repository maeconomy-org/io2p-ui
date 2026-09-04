'use client'

import { useCallback } from 'react'
import { useTheme as useNextTheme } from 'next-themes'

import type { ThemePreference } from '@/constants'
import { usePreference } from '@/hooks/ui/use-preference'

// Module scope, not a ref: the browser runs ONE view transition at a time, and
// the two callers that collide are two different components.
let pending: string | null = null
let running = 0

/**
 * Wraps next-themes' setTheme with a View Transition (columns-slide).
 * Falls back to instant set on unsupported browsers or when the user has
 * `prefers-reduced-motion: reduce`.
 *
 * Use this everywhere theme is changed so the animation is consistent, and so
 * the choice reaches the account. next-themes only ever writes localStorage,
 * which made the theme a property of the machine: dark on the laptop was still
 * light on the phone, and a shared login inherited the last person's.
 *
 * `applyTheme` is the same transition WITHOUT the account write. It exists for
 * the reconcile in `PreferenceSync`: that one is applying a value it just read
 * from `/me`, so persisting would PATCH the node with its own answer.
 */
export function useTheme() {
  const { theme, setTheme: nativeSetTheme, ...rest } = useNextTheme()
  const [, storeTheme] = usePreference('theme')

  const applyTheme = useCallback(
    (value: string) => {
      // `PreferenceSync` reconciles against the account, and the optimistic
      // cache write lands BEFORE the transition callback reaches next-themes.
      // So it reads the new theme beside the old one, calls this a second time,
      // and that second transition skips the first — `AbortError` in the
      // overlay and a slide that never plays.
      if (value === pending) return

      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (
        typeof document === 'undefined' ||
        !document.startViewTransition ||
        reducedMotion
      ) {
        nativeSetTheme(value)
        return
      }

      document.documentElement.classList.add('columns-slide-transition')
      const transition = document.startViewTransition(() =>
        nativeSetTheme(value)
      )
      pending = value
      running += 1

      // Two clicks on two DIFFERENT themes still skip a transition, and a
      // skipped one rejects `ready`. That is a fast user, not an error.
      transition.ready.catch(() => {})
      transition.finished
        .catch(() => {})
        .finally(() => {
          if (pending === value) pending = null
          running -= 1
          // The last transition owns the class. An earlier one removing it
          // mid-animation leaves the newer slide with no clip-path.
          if (running === 0) {
            document.documentElement.classList.remove(
              'columns-slide-transition'
            )
          }
        })
    },
    [nativeSetTheme]
  )

  const setTheme = useCallback(
    (value: string) => {
      applyTheme(value)
      storeTheme(value as ThemePreference)
    },
    [applyTheme, storeTheme]
  )

  return { theme, setTheme, applyTheme, ...rest }
}

/** Test surface — the module state above outlives one test otherwise. */
export function resetThemeTransition() {
  pending = null
  running = 0
}
