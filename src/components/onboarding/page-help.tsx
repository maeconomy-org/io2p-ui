'use client'

import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, ConceptHint } from '@/components/ui'
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

  return (
    <ConceptHint
      label={t(`concepts.${concept}.label`)}
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
