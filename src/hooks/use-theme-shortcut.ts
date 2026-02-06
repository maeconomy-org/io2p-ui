'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const SUPPORTED_LOCALES = ['en', 'nl'] as const

/**
 * Global keyboard shortcuts (ignored when focused on inputs/dialogs):
 * - `t` — Cycle theme: light → dark → system
 * - `l` — Toggle language: en ↔ nl
 */
export function useKeyboardShortcuts() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      // Ignore if focused on an input element
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="combobox"]') ||
        target.closest('[data-radix-popper-content-wrapper]')
      )
        return

      if (e.key === 't') {
        e.preventDefault()
        const next =
          theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
        setTheme(next)
      }

      if (e.key === 'l') {
        e.preventDefault()
        const current =
          document.cookie
            .split('; ')
            .find((c) => c.startsWith('NEXT_LOCALE='))
            ?.split('=')[1] ||
          document.documentElement.lang ||
          'en'
        const currentIndex = SUPPORTED_LOCALES.indexOf(
          current as (typeof SUPPORTED_LOCALES)[number]
        )
        const next =
          SUPPORTED_LOCALES[(currentIndex + 1) % SUPPORTED_LOCALES.length]
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
        window.location.reload()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [theme, setTheme])
}

/** @deprecated Use useKeyboardShortcuts instead */
export const useThemeShortcut = useKeyboardShortcuts
