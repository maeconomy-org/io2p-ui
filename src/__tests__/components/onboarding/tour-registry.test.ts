import { describe, it, expect } from 'vitest'

import {
  TOURS,
  getTour,
  type TourId,
} from '@/components/onboarding/tour-registry'
import { TOUR_ANCHORS } from '@/constants'
import en from '@/messages/onboarding/en.json'
import nl from '@/messages/onboarding/nl.json'
import type { TourMessages } from '@/components/onboarding/tour-messages'

const bundle = (b: unknown) => b as unknown as TourMessages

describe('tour registry', () => {
  it('has a unique id per tour', () => {
    const ids = TOURS.map((tour) => tour.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves a tour by id, and nothing for an unknown one', () => {
    expect(getTour('create-object')?.route).toBe('/objects')
    expect(getTour('nope' as TourId)).toBeUndefined()
  })

  it('targets only anchors that exist in the registry', () => {
    const known = new Set(
      Object.values(TOUR_ANCHORS).map((value) => `[data-tour="${value}"]`)
    )

    for (const tour of TOURS) {
      for (const step of tour.steps(bundle(en))) {
        expect(known.has(step.element), `${tour.id}: ${step.element}`).toBe(
          true
        )
      }
    }
  })

  it('gives every step real copy in both locales', () => {
    for (const tour of TOURS) {
      for (const locale of [en, nl]) {
        for (const { popover } of tour.steps(bundle(locale))) {
          // tourText falls back to the literal "group.key" when a string is
          // missing, so a dotted path here means untranslated copy shipped.
          expect(popover.title).not.toMatch(/^\w+\.\w+$/)
          expect(popover.description).not.toMatch(/^\w+\.\w+$/)
          expect(popover.title.length).toBeGreaterThan(0)
          expect(popover.description.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps every tour short enough to finish', () => {
    for (const tour of TOURS) {
      expect(tour.steps(bundle(en)).length).toBeGreaterThan(0)
      expect(
        tour.steps(bundle(en)).length,
        `${tour.id} is too long to be opt-in`
      ).toBeLessThanOrEqual(10)
    }
  })

  it('sends each tour to a route that exists', () => {
    const ROUTES = [
      '/objects',
      '/processes',
      '/templates',
      '/formulas',
      '/shares',
    ]
    for (const tour of TOURS) {
      expect(ROUTES, `${tour.id} -> ${tour.route}`).toContain(tour.route)
    }
  })
})
