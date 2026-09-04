'use client'

import { useCallback, useRef } from 'react'
import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, ConceptHint } from '@/components/ui'
import { PREF_FLAG, PREF_NS, flagKey } from '@/constants'
import { useFlagPreference } from '@/hooks/ui/use-preference'
import { TOUR_START_EVENT } from './constants'
import type { TourId } from './tour-registry'

/**
 * The one help affordance in a page heading.
 *
 * Replaces a ⓘ and a ? sitting side by side, which read as two unrelated
 * mysteries and appeared on some pages but not others. One control, the same
 * icon everywhere: it defines the page's concept, and — where a walkthrough
 * exists — offers to start it from inside the same card.
 *
 * `tour` is optional because not every page has a walkthrough, but every page
 * has a concept worth defining. That asymmetry is why the tour lives *in* the
 * hint rather than the other way round.
 *
 * The dot marks a concept this account has never opened. It is deliberately the
 * only onboarding state a page carries: a TOUR is remembered by nothing, so it
 * can be started, stopped and started again as often as the user likes.
 */
export function PageHelp({
  concept,
  tour,
}: {
  /** Key under `concepts.*` in the message catalogue. */
  concept: string
  tour?: TourId
}) {
  const t = useTranslations()
  const [read, markRead, resolved] = useFlagPreference(
    PREF_NS.onboarding,
    flagKey(PREF_FLAG.hint, concept)
  )

  // `resolved` guards the dot rather than gating the hint: without it the dot
  // would appear on every cold load and vanish once `/me` answered.
  const unread = resolved && !read

  // The optimistic update already flips `read`, but a second open in the same
  // tick would still see the old value. The latch makes "exactly one write" a
  // property of the code rather than of the timing.
  const wroteRef = useRef(false)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open || read || wroteRef.current) return
      wroteRef.current = true
      markRead()
    },
    [read, markRead]
  )

  return (
    <ConceptHint
      label={t(`concepts.${concept}.label`)}
      unread={unread}
      unreadLabel={t('onboarding.hintUnread')}
      onOpenChange={handleOpenChange}
      footer={
        tour ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(TOUR_START_EVENT, { detail: { id: tour } })
              )
            }
          >
            <Play className="mr-2 h-3.5 w-3.5" />
            {t('onboarding.startTour')}
          </Button>
        ) : undefined
      }
    >
      {t(`concepts.${concept}.body`)}
    </ConceptHint>
  )
}
