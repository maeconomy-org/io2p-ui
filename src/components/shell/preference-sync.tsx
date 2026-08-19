'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

import {
  PREF_COOKIE_NAME,
  PREFERENCES,
  encodePreferenceCookie,
  packHintsFromPreferences,
} from '@/constants'
import { useAuth } from '@/contexts'
import { useTheme } from '@/hooks/use-theme'
import { usePreference } from '@/hooks/ui/use-preference'
import { readCookie, writeCookie } from '@/lib/cookies'

/**
 * Mirrors the render-critical preferences into a cookie the root layout reads.
 *
 * It is the ONLY writer of that cookie in the app, and the React Query cache
 * drives it: an optimistic write, a server confirmation and a rollback are all
 * `setQueryData` on `users.current`, so all three mirror for free and no call
 * site ever touches `document.cookie`.
 *
 * `/me` always wins. The desired value is computed only from `preferences`, with
 * no merge against the cookie — so a change made on another device corrects this
 * one on the next load rather than being fought over.
 */
export function PreferenceSync() {
  const { preferences, authLoading, isAuthenticated } = useAuth()
  const { theme, applyTheme } = useTheme()
  const [, storeTheme] = usePreference('theme')
  const [, storeLocale] = usePreference('locale')
  const locale = useLocale()
  const router = useRouter()

  const hints = useMemo(
    () => packHintsFromPreferences(preferences),
    [preferences]
  )
  // A primitive, not the `preferences` object: that gets a fresh identity on
  // every setQueryData, while this changes only when a MIRRORED value does.
  const encoded = useMemo(() => encodePreferenceCookie(hints), [hints])

  const settled = isAuthenticated && !authLoading && !!preferences

  useEffect(() => {
    if (!settled) return
    if (readCookie(PREF_COOKIE_NAME) === encoded) return
    writeCookie(PREF_COOKIE_NAME, encoded)
  }, [encoded, settled])

  // The account wins over this browser — the correction a change on another
  // device needs. `applyTheme`, so it does not PATCH back what it just read.
  const serverTheme = hints.theme
  useEffect(() => {
    if (!settled || !serverTheme || serverTheme === theme) return
    applyTheme(serverTheme)
  }, [settled, serverTheme, theme, applyTheme])

  /**
   * The account's language needs a new SERVER render, so ask for one.
   *
   * Leaving it to the next navigation does not work, however much cheaper it
   * looks. A client navigation re-renders the SEGMENT, never the root layout —
   * and the root layout is what hands `NextIntlClientProvider` its catalogue.
   * The page arrives half translated: Server Components in the new language,
   * every `useTranslations` still in the one that was loaded with the tab.
   *
   * The cookie effect above has already corrected the mirror, so the refreshed
   * request carries the new language. Same order `useSetLocale` depends on.
   *
   * The guard keys on the TARGET, not on the mount. A refresh that does not
   * take — the cookie could not be written — leaves the target unchanged and
   * must not loop. A target that changes is a new language from another device,
   * and that one has to be honoured in a tab already open.
   */
  const serverLocale = hints.locale
  const refreshedForRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!settled || !serverLocale || serverLocale === locale) return
    if (refreshedForRef.current === serverLocale) return
    refreshedForRef.current = serverLocale
    router.refresh()
  }, [settled, serverLocale, locale, router])

  // Existing users carry a theme and a locale this browser knows but the node
  // has never seen. Without this one push, both silently reset to the defaults
  // on the first load of this build. Once per mount, never on a failed `/me`.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!settled || seededRef.current) return
    seededRef.current = true
    if (!serverTheme && PREFERENCES.theme.validate(theme)) storeTheme(theme)
    if (!serverLocale && PREFERENCES.locale.validate(locale))
      storeLocale(locale)
  }, [
    settled,
    serverTheme,
    theme,
    storeTheme,
    serverLocale,
    locale,
    storeLocale,
  ])

  return null
}
