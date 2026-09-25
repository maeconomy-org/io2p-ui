import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { gotoList } from '../utils/sheet'

/**
 * L5 — hiding a column is an ACCOUNT preference, not a property of the tab that hid it.
 *
 * `objectColumnsHidden` is stored on the node like every other preference, so the failure this
 * pins is the quiet one: the toggle works, the column goes, and the choice is gone on the next
 * load. Nothing in the UI says which of those two happened.
 *
 * A write spec, and one that restores in a hook rather than on the happy path — a hidden column
 * outlives the run, and half this suite reads the objects table.
 */

const COLUMN = 'createdAt'

const option = (page: Page) => page.getByTestId(`column-option-${COLUMN}`)

/**
 * The header addressed by COLUMN ID, never by its prose. `objects.fields.created` is "Created at" in
 * en and "Aangemaakt op" in nl, so a `getByRole('columnheader', { name: /created at/i })` matches
 * nothing on a Dutch account — and both of this file's absence assertions then pass having tested
 * nothing at all, in exactly the state a run is most likely to be left in.
 */
const header = (page: Page) => page.getByTestId(`column-header-${COLUMN}`)

async function openToggle(page: Page): Promise<void> {
  // `toPass`: the header button is clickable before hydration and a click that lands early is
  // swallowed in silence — the same trap `selectView` documents.
  await expect(async () => {
    await page.getByTestId('column-toggle').click()
    await expect(option(page)).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
}

async function setColumn(page: Page, visible: boolean): Promise<void> {
  await gotoList(page, '/objects')
  await expect(page.getByTestId('data-table-row').first()).toBeVisible()
  await openToggle(page)
  if ((await option(page).getAttribute('aria-checked')) !== String(visible)) {
    await option(page).click()
  }
  await page.keyboard.press('Escape')
}

test.describe('02 - objects list / columns', () => {
  test('L5: hiding a column survives a reload', async ({ page }) => {
    await setColumn(page, false)

    // The column is gone from the TABLE, not merely unchecked in the menu — the menu is the control
    // and the header is the outcome, and a toggle that only moved its own checkbox would satisfy
    // the former.
    await expect(header(page)).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await expect(header(page)).toHaveCount(0)

    // And the menu agrees after the reload — the preference is what the control reads back, so a
    // header that stayed hidden while the checkbox reset would mean the two disagree about state.
    await openToggle(page)
    await expect(option(page)).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Escape')
  })

  /**
   * Unconditional and to a known value. `objectColumnsHidden` is account state: a column left
   * hidden reaches every later spec that reads this table, and one that asserts on the column is
   * then failing for something it never touched.
   */
  test.afterEach(async ({ page }) => {
    await setColumn(page, true)
    await expect(header(page)).toHaveCount(1)
  })
})
