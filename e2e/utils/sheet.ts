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

/**
 * `expectClose: false` for a submit the app is expected to REFUSE — validation keeps the sheet open
 * holding the work, so waiting for it to close asserts the opposite of what the caller is testing.
 */
export async function saveSheet(
  page: Page,
  { expectClose = true }: { expectClose?: boolean } = {}
): Promise<void> {
  const save = page.getByTestId('sheet-save')
  await expect(save).toBeEnabled()
  await save.click()
  if (expectClose) await expect(save).toBeHidden()
}

/**
 * Save, and wait for the write to LAND rather than merely for the click.
 *
 * `saveSheet` returns as soon as the button was clicked. Navigating straight afterwards aborts the
 * request still in flight, and an aborted fetch logs a console error — which the harness fails the
 * test on. The symptom is a NetworkError with `status: 0` and a test that reads as a broken save
 * rather than as a race the spec created itself.
 *
 * Every rollups case that writes then polls needs this: the poll's first act is `page.goto`.
 */
export async function saveSheetAndSettle(page: Page): Promise<void> {
  // Armed BEFORE the click, or the response can land before anything is listening.
  const written = page.waitForResponse(
    (res) =>
      ['PATCH', 'POST'].includes(res.request().method()) &&
      /\/api\/v1\/(objects|processes)\//.test(res.url())
  )
  await saveSheet(page, { expectClose: false })
  await written
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

/**
 * The open dialog, waited for.
 *
 * Library creates (formula, constant, template) open a Radix dialog rather than the entity sheet.
 * Filling `page.getByLabel(/name/i)` instead resolves INSTANTLY to the list's `Name column options`
 * button, so Playwright's auto-wait never covers the dialog's open transition — the fill lands on a
 * button and reports "Element is not an <input>".
 */
export async function openDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}
