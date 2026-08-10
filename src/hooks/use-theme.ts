'use client'

import { useCallback } from 'react'
import { useTheme as useNextTheme } from 'next-themes'

import type { ThemePreference } from '@/constants'
import { usePreference } from '@/hooks/ui/use-preference'

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
      transition.finished.finally(() => {
        document.documentElement.classList.remove('columns-slide-transition')
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
