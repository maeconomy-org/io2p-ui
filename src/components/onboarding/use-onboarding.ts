'use client'

import { useCallback } from 'react'

import { ONBOARDING_EPOCH } from '@/constants'
import { usePreference } from '@/hooks/ui/use-preference'

/** Ids are stable strings, stored in the account blob under `toursSeen`. */
export const INITIAL_LOGIN_TOUR = 'initial-login'

/**
 * Whether this account has already seen `tourId`, and how to record that it has.
 *
 * Replaces a bare `localStorage['onboarding:initial-login:v1']`, which was keyed
 * to the machine rather than the account — on a shared login, whoever finished
 * the tour first silenced it for everyone after them.
 *
 * `resolved` is not optional for callers. The blob is keyed by account, so
 * nothing can be read until auth settles; acting on `seen === false` before then
 * would replay the tour on every cold load.
 */
export function useTourSeen(tourId: string) {
  const [epoch, setEpoch] = usePreference('onboardingEpoch')
  const [toursSeen, setToursSeen, resolved] = usePreference('toursSeen')

  // State written before the current epoch is treated as absent rather than
  // deleted — that is the whole re-onboarding lever, and it costs nothing until
  // the next write.
  const stale = epoch < ONBOARDING_EPOCH
  const seen = !stale && toursSeen.includes(tourId)

  const markSeen = useCallback(() => {
    setToursSeen(stale ? [tourId] : [...new Set([...toursSeen, tourId])])
    if (stale) {
      // Ordered after the list write: both go through the same
      // read-modify-write, so the epoch lands on a blob that already carries the
      // new list rather than overwriting it.
      setEpoch(ONBOARDING_EPOCH)
    }
  }, [stale, tourId, toursSeen, setToursSeen, setEpoch])

  return { seen, markSeen, resolved }
}

/**
 * Which "what's new" beacons this account has already acknowledged.
 *
 * Shares the epoch with the tours: bumping `ONBOARDING_EPOCH` re-shows the
 * beacons too, which is the point — the next reshuffle needs the same lever.
 */
export function useHintsDismissed() {
  const [epoch, setEpoch] = usePreference('onboardingEpoch')
  const [hintsDismissed, setHintsDismissed, resolved] =
    usePreference('hintsDismissed')

  const stale = epoch < ONBOARDING_EPOCH
  const dismissed = stale ? NO_HINTS : hintsDismissed

  const dismiss = useCallback(
    (hintId: string) => {
      setHintsDismissed(
        stale ? [hintId] : [...new Set([...hintsDismissed, hintId])]
      )
      if (stale) setEpoch(ONBOARDING_EPOCH)
    },
    [stale, hintsDismissed, setHintsDismissed, setEpoch]
  )

  return { dismissed, dismiss, resolved }
}

/** Stable empty list, so `dismissed` keeps a constant identity across renders. */
const NO_HINTS: string[] = []
