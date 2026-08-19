import { expect, type Locator, type Page } from '@playwright/test'

import { tour } from './selectors'

/** Object sheet: properties/files/relations/details. Process sheet: details/files/inputs/outputs. */
export type SheetTab =
  | 'properties'
  | 'files'
  | 'relations'
  | 'details'
  | 'inputs'
  | 'outputs'

export function sheet(page: Page): Locator {
  return page.getByTestId('entity-sheet')
}

/** The object create sheet is linear — it renders no tabs. */
export async function openCreateSheet(page: Page): Promise<Locator> {
  await tour(page, 'createObject').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  return panel
}

export async function openObjectSheet(
  page: Page,
  row: Locator
): Promise<Locator> {
  await row.getByTestId('object-details-button').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  return panel
}

/** Edit mode is sheet-WIDE: entering from any tab makes every tab editable. */
export async function enterEditMode(page: Page): Promise<void> {
  await page.getByTestId('sheet-edit').click()
  await expect(page.getByTestId('sheet-save')).toBeVisible()
}

export async function switchTab(page: Page, tab: SheetTab): Promise<void> {
  await page.getByTestId(`sheet-tab-${tab}`).click()
}

export async function saveSheet(page: Page): Promise<void> {
  const save = page.getByTestId('sheet-save')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(save).toBeHidden()
}

/**
 * Appends a property row and returns its index. Separate from `fillProperty` because deciding
 * whether to add by reading `count()` does not retry, so an unrendered row reads as zero.
 */
export async function addProperty(page: Page, index: number): Promise<number> {
  await page.getByTestId('add-property').click()
  await expect(page.getByTestId(`property-row-${index}`)).toBeVisible()
  return index
}

export async function fillProperty(
  page: Page,
  index: number,
  name: string,
  value: string
): Promise<void> {
  await page.getByTestId(`property-name-${index}`).fill(name)
  await page.getByTestId(`property-value-${index}-0`).fill(value)
}

/**
 * A row loaded from the server starts COLLAPSED, and Radix unmounts collapsed content — the value
 * input does not exist until this runs.
 */
export async function expandProperty(page: Page, index: number): Promise<void> {
  await page.getByTestId(`property-toggle-${index}`).click()
  // A DERIVED value renders no text input, so waiting only for one hangs on every formula row.
  await expect(
    page
      .getByTestId(`property-value-${index}-0`)
      .or(page.getByTestId(`derived-value-${index}-0`))
  ).toBeVisible()
}

/** A property with content needs Trash then Confirm; the confirm state cancels on blur. */
export async function removeProperty(
  page: Page,
  index: number,
  { hasContent = true } = {}
): Promise<void> {
  await page.getByTestId(`property-remove-${index}`).click()
  if (hasContent) {
    await page.getByTestId(`property-remove-confirm-${index}`).click()
  }
}

/**
 * Navigate to a list route and wait for ITS table, not the outgoing page's.
 *
 * `page.goto()` resolves before React has torn the previous route down, so for a moment BOTH
 * tables carry `data-testid="data-table"` — the old one hidden, the new one painting. A bare
 * `expect(getByTestId('data-table')).toBeVisible()` then fails strict mode with "resolved to 2
 * elements", which reads as a duplicate-testid bug rather than a transition.
 *
 * `.last()` is the arriving one; waiting for it to be visible is what proves the transition is over.
 */
export async function gotoList(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('data-table').last()).toBeVisible()
}
