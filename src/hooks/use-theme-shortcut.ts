'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

import { useTheme } from '@/hooks/use-theme'
import { useSetLocale } from '@/hooks/ui/use-set-locale'
import { routing } from '@/i18n/routing'

/**
 * Global keyboard shortcuts (ignored when focused on inputs/dialogs):
 * - `t` — Toggle theme: light ↔ dark
 * - `l` — Toggle language: en ↔ nl
 */
export function useKeyboardShortcuts() {
  const { resolvedTheme, setTheme } = useTheme()
  const locale = useLocale()
  const setLocale = useSetLocale()

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
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      }

      if (e.key === 'l') {
        e.preventDefault()
        // `findIndex`, not `indexOf`: next-intl types `useLocale()` as a plain
        // string. A miss gives -1, which wraps to the first locale.
        const index = routing.locales.findIndex((known) => known === locale)
        setLocale(routing.locales[(index + 1) % routing.locales.length])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resolvedTheme, setTheme, locale, setLocale])
}
