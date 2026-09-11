'use client'

import { useEffect, useRef, useState } from 'react'

import type { ScopeFilterValue } from '@/components/filters'
import type { PreferenceValues } from '@/constants/preferences'
import { usePreference } from './use-preference'

type ScopePreferenceKey = {
  [K in keyof PreferenceValues]: PreferenceValues[K] extends ScopeFilterValue
    ? K
    : never
}[keyof PreferenceValues]

/**
 * The access slice a list opens on: the account's stored default, then whatever the user picks for
 * this visit.
 *
 * `usePreference` returns its seed until `/me` lands, so reading it as initial state would pin every
 * account to the fallback. Adopted ONCE when it resolves — a plain sync would also overwrite an
 * excursion the user is part-way through, since a refetch hands the same preference back.
 */
export function useScopePreference(
  key: ScopePreferenceKey
): [ScopeFilterValue, (next: ScopeFilterValue) => void, ScopeFilterValue] {
  const [stored, , resolved] = usePreference(key)
  const [scope, setScope] = useState<ScopeFilterValue>(stored)
  const adopted = useRef(false)

  useEffect(() => {
    if (!resolved || adopted.current) return
    adopted.current = true
    setScope(stored)
  }, [resolved, stored])

  // The stored value is returned too: the filter badge measures wandering from it, not selection.
  return [scope, setScope, stored]
}
