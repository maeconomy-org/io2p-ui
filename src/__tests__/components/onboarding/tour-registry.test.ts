import { describe, it, expect } from 'vitest'

import { tourIcon } from '@/components/navbar/nav-icons'
import {
  TOURS,
  groupedTours,
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

  /**
   * An `undo` is what Previous does at the step AFTER the one carrying it, so it
   * only ever runs to reverse an `action`. Written on a step with no action it
   * is dead code that reads as coverage.
   */
  it('pairs every undo with the action it reverses', () => {
    for (const tour of TOURS) {
      for (const step of tour.steps(bundle(en))) {
        if (step.undo) {
          expect(step.action, `${tour.id}: ${step.element}`).toBeDefined()
        }
      }
    }
  })

  /**
   * The menu renders groups, not the raw list — a tour whose route no group
   * claims would vanish from the only place it can be started.
   */
  it('files every tour under exactly one menu group', () => {
    const grouped = groupedTours().flatMap((group) => group.tours)
    expect(grouped.map((tour) => tour.id).sort()).toEqual(
      TOURS.map((tour) => tour.id).sort()
    )
  })

  /**
   * The bug this pins was visible at a glance and invisible to every other
   * check: create-object and work-with-drafts both run on /objects, so both
   * derived the same icon and the menu stacked two identical marks. Adjacent
   * rows are exactly where a repeat reads as a mistake.
   */
  it('shows no two identical icons inside one menu group', () => {
    for (const group of groupedTours()) {
      const icons = group.tours.map((tour) => tourIcon(tour.route, tour.icon))
      expect(new Set(icons).size, `${group.key} repeats an icon`).toBe(
        icons.length
      )
    }
  })

  it('gives every tour an icon', () => {
    for (const tour of TOURS) {
      expect(tourIcon(tour.route, tour.icon), tour.id).toBeDefined()
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
      '/import',
      '/constants',
      '/rollup-rules',
    ]
    for (const tour of TOURS) {
      expect(ROUTES, `${tour.id} -> ${tour.route}`).toContain(tour.route)
    }
  })
})
