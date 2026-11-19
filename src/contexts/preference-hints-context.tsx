'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { PreferenceHints } from '@/constants'

/**
 * The first-paint preference hints, decoded from the cookie by the ROOT LAYOUT
 * and handed down as a prop.
 *
 * The hint must ONLY ever arrive this way. Reading `document.cookie` here
 * instead would let the first client render disagree with the server's — another
 * tab can write between the response and hydration — which is the exact
 * hydration mismatch `usePreference` exists to prevent.
 *
 * The value is frozen for the document's lifetime, because the root layout does
 * not re-render on a client navigation. That is correct: after hydration the
 * stored value wins and the hint is only the fallback.
 */

const PreferenceHintsContext = createContext<PreferenceHints>({})

export function PreferenceHintsProvider({
  hints,
  children,
}: {
  hints: PreferenceHints
  children: ReactNode
}) {
  return (
    <PreferenceHintsContext.Provider value={hints}>
      {children}
    </PreferenceHintsContext.Provider>
  )
}

/**
 * Defaults to `{}` outside a provider rather than throwing, so a unit test that
 * renders one preference consumer does not have to mount the shell.
 */
export function usePreferenceHints(): PreferenceHints {
  return useContext(PreferenceHintsContext)
}
