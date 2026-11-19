'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * `false` during SSR and on the first client render, `true` from the second on.
 *
 * Use it to gate any render branch that depends on client-only state — auth
 * session, `navigator`, `localStorage`. Without it, the server renders one
 * branch and the client's first render picks the other, which is a hydration
 * mismatch: React discards the server HTML and re-renders the whole subtree.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` because it needs
 * no state write during render or in an effect — the server snapshot IS the
 * "not mounted" answer, so there is nothing to synchronise.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}
