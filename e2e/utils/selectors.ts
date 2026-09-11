import type { Locator, Page } from '@playwright/test'

import {
  sel,
  TOUR_ANCHORS,
  type TourAnchorName,
} from '@/constants/tour-anchors'
import { resolveKey } from '@/constants/property-dictionary'

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

/**
 * A sibling option in the formula binding picker, addressed by the property's NAME.
 *
 * The option's testid is minted from the property KEY, not its label — the label goes through
 * `resolvePropertyLabel`, so `width` rendered as `formula-sibling-Width` in English and
 * `formula-sibling-Breedte` in Dutch, silently coupling three spec files to the account's language.
 *
 * Specs still pass the name they typed, and this applies the app's own `resolveKey` to it: a
 * dictionary term resolves to its stable key, anything else slugs. So the call site stays readable
 * and the locator stops moving.
 */
export function siblingTestId(propertyName: string): string {
  return `formula-sibling-${resolveKey(propertyName).key}`
}

/** The same option as a page-scoped locator, for the common unscoped case. */
export function formulaSibling(page: Page, propertyName: string): Locator {
  return page.getByTestId(siblingTestId(propertyName))
}
