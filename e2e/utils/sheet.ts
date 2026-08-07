/**
 * Driving the entity sheet.
 *
 * The refactor replaced N per-section Edit/Save cycles with ONE form, one `editing` flag, four tabs
 * and one footer — so "edit the properties" is no longer a thing a spec does to a section, it is a
 * thing it does to the sheet. These helpers encode that, so a spec reads as the user's intent
 * rather than as a sequence of clicks.
 */

import { expect, type Locator, type Page } from '@playwright/test'

import { tour } from './selectors'

export type SheetTab = 'properties' | 'files' | 'relations' | 'details'

export function sheet(page: Page): Locator {
  return page.getByTestId('entity-sheet')
}

/** Opens the create sheet from the objects list. Renders NO tabs — the create flow is linear. */
export async function openCreateSheet(page: Page): Promise<Locator> {
  await tour(page, 'createObject').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  return panel
}

/** Opens an existing object's sheet from its row's Details button. */
export async function openObjectSheet(
  page: Page,
  row: Locator
): Promise<Locator> {
  await row.getByTestId('object-details-button').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  return panel
}

/**
 * Enters edit mode. Sheet-WIDE: entering from the Details tab makes Properties editable too, which
 * is the single biggest behavioural change from the per-section model and worth encoding once.
 */
export async function enterEditMode(page: Page): Promise<void> {
  await page.getByTestId('sheet-edit').click()
  await expect(page.getByTestId('sheet-save')).toBeVisible()
}

export async function switchTab(page: Page, tab: SheetTab): Promise<void> {
  await page.getByTestId(`sheet-tab-${tab}`).click()
}

/** Save is disabled while the form is clean, so this also asserts something was actually changed. */
export async function saveSheet(page: Page): Promise<void> {
  const save = page.getByTestId('sheet-save')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(save).toBeHidden()
}

/**
 * Appends a property row and returns its index.
 *
 * Separate from `fillProperty` on purpose: deciding whether to add by reading `count()` looks
 * convenient but does not retry, so an unrendered row reads as zero and the helper adds a second
 * one. The caller knows how many rows it has created; the DOM is not the place to ask.
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
 * Expands a property row so its name and values are reachable.
 *
 * A row added in this session opens expanded; one loaded from the server starts COLLAPSED
 * (`useState(isNew)` in property-fields), and Radix unmounts collapsed content — so on an existing
 * object the value input does not exist until this runs.
 */
export async function expandProperty(page: Page, index: number): Promise<void> {
  await page.getByTestId(`property-toggle-${index}`).click()
  await expect(page.getByTestId(`property-value-${index}-0`)).toBeVisible()
}

/**
 * A property with content needs Trash then Confirm; an empty one goes on the first click. The
 * confirm state also cancels on blur, so the two clicks cannot be separated by anything else.
 */
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
