'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui'
import { TOUR_START_EVENT } from './constants'
import type { TourId } from './tour-registry'

/**
 * The second way into a walkthrough, next to the thing it walks you through.
 *
 * The profile-menu submenu is the complete list, but it is also the least
 * discoverable place in the app — nobody opens an account menu looking for help
 * with the page they are already on. This puts the relevant tour one click from
 * the header it belongs to.
 */
export function PageTourButton({ tour }: { tour: TourId }) {
  const t = useTranslations()
  const label = t('onboarding.startTour', {
    tour: t(`onboarding.tours.${tour}`),
  })

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(TOUR_START_EVENT, { detail: { id: tour } })
        )
      }
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  )
}
