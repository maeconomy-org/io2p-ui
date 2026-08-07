/**
 * Typed locators, built from the app's own registries.
 *
 * The point is that a rename in `src/` becomes a COMPILE failure here rather than a locator that
 * quietly matches nothing. That only works because `tsconfig.e2e.json` puts this folder inside the
 * type gate — before that, `e2e/` had never been typechecked and 25 errors had accumulated,
 * including a `window.__testHooks` that had been deleted from the app months earlier.
 */

import type { Locator, Page } from '@playwright/test'

import {
  sel,
  TOUR_ANCHORS,
  type TourAnchorName,
} from '@/constants/tour-anchors'

/**
 * A `data-tour` anchor as a locator.
 *
 * Uses the app's own `sel()` so the attribute name and quoting live in one place. Covers nav, the
 * search button, filters, the view selector, five create buttons, every create-sheet section and
 * the Shares tabs — with no new attributes, because onboarding already made those anchors
 * mandatory and typed.
 */
export function tour(page: Page, name: TourAnchorName): Locator {
  return page.locator(sel(name))
}

/** Every anchor, for the harness spec that checks each one resolves on the page that owns it. */
export const ALL_TOUR_ANCHORS = Object.keys(TOUR_ANCHORS) as TourAnchorName[]

/**
 * The `testIdPrefix` values `EntityActionsCell` is mounted with. Not derivable from the component —
 * it takes a `string` — so this list is checked by `00-harness/selectors.read.spec.ts` instead.
 */
export type EntityPrefix =
  | 'object'
  | 'process'
  | 'template'
  | 'formula'
  | 'constant'
  | 'share'
  | 'shared-by-me'
  | 'draft'

/**
 * Row actions for any entity table.
 *
 * `details` and `menu` are scoped to the row; `action` is not — the dropdown content renders in a
 * portal at the document root, so a row-scoped locator finds nothing.
 */
export function rowActions(page: Page, prefix: EntityPrefix, row: Locator) {
  return {
    details: row.getByTestId(`${prefix}-details-button`),
    menu: row.getByTestId(`${prefix}-actions-dropdown`),
    action: (key: string) => page.getByTestId(`${prefix}-action-${key}`),
  }
}
