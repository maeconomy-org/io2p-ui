'use client'

import { useCallback } from 'react'

import { usePreference } from './use-preference'

/**
 * Rows per page, stored on the account.
 *
 * The single owner. It replaced three independent `useState`s — the shared list
 * hook plus two hand-rolled copies in `/shares` — which meant a size chosen on
 * one page was already forgotten on the next, and forgotten again on reload.
 *
 * `onReset` is injected rather than owned here because the page that holds the
 * paging state is the one that has to go back to page 1; this hook has no idea
 * which query it feeds.
 */
export function usePageSize(
  onReset: () => void
): [number, (size: number) => void] {
  const [pageSize, setPageSize] = usePreference('pageSize')

  const handleChange = useCallback(
    (size: number) => {
      setPageSize(size)
      onReset()
    },
    [setPageSize, onReset]
  )

  return [pageSize, handleChange]
}
