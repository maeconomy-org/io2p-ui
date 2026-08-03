'use client'

import { useEffect, useRef } from 'react'

import { TOUR_ACTION_EVENT } from './constants'

/**
 * Actions a tour can ask a page to perform.
 *
 * Named after the page and the effect, not the control — the tour should not
 * care whether the trigger is a button, a dropdown item, or something else
 * tomorrow.
 */
export const TOUR_ACTIONS = {
  createObject: 'objects.create',
  createTemplate: 'templates.create',
  createFormula: 'formulas.create',
  createShare: 'shares.create',
} as const

export type TourAction = (typeof TOUR_ACTIONS)[keyof typeof TOUR_ACTIONS]

/** Fire a tour action at whichever page is listening. */
export const runTourAction = (action: TourAction) =>
  window.dispatchEvent(
    new CustomEvent(TOUR_ACTION_EVENT, { detail: { action } })
  )

/**
 * Let a page answer one tour action.
 *
 * The handler is held in a ref so the listener is registered once, rather than
 * torn down and rebuilt on every render that changes the callback's identity.
 */
export function useTourAction(action: TourAction, handler: () => void) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail
      if (detail?.action === action) handlerRef.current()
    }

    window.addEventListener(TOUR_ACTION_EVENT, onAction)
    return () => window.removeEventListener(TOUR_ACTION_EVENT, onAction)
  }, [action])
}
