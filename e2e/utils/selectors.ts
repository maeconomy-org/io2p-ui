import type { Locator, Page } from '@playwright/test'

import {
  sel,
  TOUR_ANCHORS,
  type TourAnchorName,
} from '@/constants/tour-anchors'

/**
 * Locators built from the app's own registries, so a rename in `src/` fails `typecheck:e2e`
 * instead of silently matching nothing.
 */
export function tour(page: Page, name: TourAnchorName): Locator {
  return page.locator(sel(name))
}

export const ALL_TOUR_ANCHORS = Object.keys(TOUR_ANCHORS) as TourAnchorName[]

/** The `testIdPrefix` values `EntityActionsCell` is mounted with. */
export type EntityPrefix =
  | 'object'
  | 'process'
  | 'template'
  | 'formula'
  | 'constant'
  | 'share'
  | 'shared-by-me'
  | 'draft'
  | 'rollup-rule'

export function rowActions(page: Page, prefix: EntityPrefix, row: Locator) {
  return {
    details: row.getByTestId(`${prefix}-details-button`),
    menu: row.getByTestId(`${prefix}-actions-dropdown`),
    // Page-scoped: the dropdown content renders in a portal at the document root.
    action: (key: string) => page.getByTestId(`${prefix}-action-${key}`),
  }
}
