'use client'

import { useCallback, useMemo } from 'react'
import type { VisibilityState } from '@tanstack/react-table'

import type { PreferenceValues } from '@/constants/preferences'
import { usePreference } from './use-preference'

type ColumnPreferenceKey = {
  [K in keyof PreferenceValues]: K extends `${string}ColumnsHidden` ? K : never
}[keyof PreferenceValues]

/**
 * Which columns a list hides, persisted per account.
 *
 * Stored as the HIDDEN ids, but TanStack wants a `{[id]: boolean}` map, so the
 * two are converted here rather than at each call site. Storing hidden-only is
 * what makes a column added in a later release visible by default.
 */
export function useColumnVisibility(
  key: ColumnPreferenceKey
): [VisibilityState, (next: VisibilityState) => void] {
  const [hidden, setHidden] = usePreference(key)

  const visibility = useMemo(
    () => Object.fromEntries(hidden.map((id) => [id, false])),
    [hidden]
  )

  const setVisibility = useCallback(
    (next: VisibilityState) => {
      setHidden(
        Object.entries(next)
          .filter(([, visible]) => visible === false)
          .map(([id]) => id)
          .sort()
      )
    },
    [setHidden]
  )

  return [visibility, setVisibility]
}
