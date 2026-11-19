'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { patchPreferenceCookie } from '@/constants'
import type { PreferenceValues } from '@/constants'

import { usePreference } from './use-preference'

/**
 * Change the interface language: store it on the account, then re-render.
 *
 * The message catalogue is chosen SERVER-side in `i18n/request.ts`, so the new
 * language cannot appear without a new server render. `router.refresh()` gets
 * one while keeping the query cache and the scroll position, where the
 * `window.location.reload()` this replaced threw both away.
 *
 * The cookie is written HERE rather than left to `PreferenceSync`: its effect
 * has not run yet at this point, and the refreshed request has to carry the new
 * value or the server answers in the old language and nothing appears to happen.
 *
 * Refresh briefly shows the route's `loading.tsx`, because it invalidates the
 * segment cache. `PreferenceSync` pays the same cost for the PASSIVE reconcile,
 * but only where the account and the cookie disagree — normally the first
 * sign-in on a browser.
 */
export function useSetLocale(): (next: PreferenceValues['locale']) => void {
  const [, storeLocale] = usePreference('locale')
  const router = useRouter()

  return useCallback(
    (next: PreferenceValues['locale']) => {
      storeLocale(next)
      patchPreferenceCookie({ locale: next })
      router.refresh()
    },
    [storeLocale, router]
  )
}
