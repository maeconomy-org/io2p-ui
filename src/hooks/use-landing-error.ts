'use client'

import { useEffect, useSyncExternalStore } from 'react'

export interface LandingErrorStore {
  read: () => string | null
  keep: () => void
  forgetSoon: () => void
}

/** One per page, at module scope: the code must outlive the URL cleanup below. */
export function createLandingErrorStore(): LandingErrorStore {
  let code: string | null | undefined
  let forgetTimer: ReturnType<typeof setTimeout> | undefined
  return {
    read() {
      if (code === undefined) {
        code = new URLSearchParams(window.location.search).get('error')
      }
      return code
    },
    keep() {
      clearTimeout(forgetTimer)
    },
    forgetSoon() {
      forgetTimer = setTimeout(() => {
        code = undefined
      }, 0)
    },
  }
}

const subscribeNever = () => () => {}

/**
 * The `?error=` code a redirect (OAuth callback, linkSocial) brought back, read once and then
 * removed from the URL so a reload does not show it again.
 *
 * The forget on unmount is deferred: StrictMode runs cleanup and setup back to back on the same
 * mount, and an immediate forget there would re-read the already-clean URL on the next render.
 */
export function useLandingError(store: LandingErrorStore): string | null {
  const code = useSyncExternalStore(subscribeNever, store.read, () => null)

  useEffect(() => {
    store.keep()
    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      params.delete('error')
      params.delete('error_description')
      const rest = params.toString()
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${rest ? `?${rest}` : ''}`
      )
    }
    return store.forgetSoon
  }, [store])

  return code
}
