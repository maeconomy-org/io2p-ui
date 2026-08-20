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
  createProcess: 'processes.create',
  createTemplate: 'templates.create',
  createFormula: 'formulas.create',
  createShare: 'shares.create',
  createConstant: 'constants.create',
  createRollupRule: 'rollupRules.create',
  /**
   * Open the import wizard tab.
   *
   * A gate like the sheet openers above, for the same reason: the wizard is
   * `forceMount`ed and merely HIDDEN when its tab is inactive, so every anchor
   * inside it is found by `querySelector` while measuring 0x0.
   */
  startImport: 'import.start',
  /**
   * Move the wizard on one step, loading the sample sheet if it has none yet.
   *
   * One action for all four crossings rather than a named one per step: the
   * walkthrough only ever goes forward through them in order, and `closeSheet`
   * already means "undo one crossing" in the other direction.
   */
  importAdvance: 'import.advance',
  /**
   * Ask the mapper for a hierarchy, and accept it.
   *
   * Two crossings rather than one because the answer is the lesson: the proposal
   * arrives with "6 rows would become 8 objects", and a wrong hierarchy is
   * obvious in that number where it is invisible in the column names.
   *
   * The mapper answers these, not the wizard — `asked` is its own state, kept
   * there because a suggestion that arrives on its own was wrong on ten of
   * sixteen sheets of a real register.
   */
  importSuggestLevels: 'import.suggestLevels',
  importHideSuggestion: 'import.hideSuggestion',
  importApplyLevels: 'import.applyLevels',
  importClearLevels: 'import.clearLevels',
  /** Drop the sample sheet. Fired when the tour ENDS, however it ended. */
  resetImport: 'import.reset',
  /**
   * Undo the opening above when the tour steps BACK across the gate.
   *
   * The steps before a gate point at the page; the steps after it point inside
   * the sheet. Going back without closing leaves the sheet covering the very
   * control the earlier step is highlighting — driver.js draws the cutout at the
   * button's coordinates, the sheet renders on top of it, and the user sees a
   * bright rectangle framing nothing.
   *
   * One generic close rather than a counterpart per open: only one page is
   * mounted at a time, so there is no ambiguity about whose sheet this means,
   * and a tour still does not have to know how any particular sheet is built.
   */
  closeSheet: 'sheet.close',
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
