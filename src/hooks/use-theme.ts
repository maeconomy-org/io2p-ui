'use client'

import { useCallback } from 'react'
import { useTheme as useNextTheme } from 'next-themes'

/**
 * Wraps next-themes' setTheme with a View Transition (columns-slide).
 * Falls back to instant set on unsupported browsers or when the user has
 * `prefers-reduced-motion: reduce`.
 *
 * Use this everywhere theme is changed so the animation is consistent.
 */
export function useTheme() {
  const { theme, setTheme: nativeSetTheme, ...rest } = useNextTheme()

  const setTheme = useCallback(
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

  return { theme, setTheme, ...rest }
}
