import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { rowActions } from '../utils/selectors'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

/**
 * What the delete dialog claims about what it is deleting.
 *
 * The count is the whole SUBTREE, not the row's `childCount` — dropping a node strands its
 * grandchildren too, and a dialog that said "1 descendant" for a three-deep chain would understate
 * what the user is about to hide. Delete does not cascade, so the copy also has to say the
 * descendants stay live.
 */

const runId = Date.now()
const ROOT = `e2e-${runId}-dd-root`
const MID = `e2e-${runId}-dd-mid`
const LEAF = `e2e-${runId}-dd-leaf`
const ALONE = `e2e-${runId}-dd-alone`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

async function createObject(page: Page, name: string, parentName?: string) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  if (parentName) {
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: parentName })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')
  }
  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

async function openDeleteDialog(page: Page, name: string) {
  const actions = rowActions(page, 'object', rowFor(page, name))
  await actions.menu.click()
  await actions.action('delete').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('02 - objects list / the delete dialog', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000)
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Three deep on purpose: `childCount` would say 1 for ROOT, the subtree says 2.
    await createObject(page, ROOT)
    await createObject(page, MID, ROOT)
    await createObject(page, LEAF, MID)
    await createObject(page, ALONE)

    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('DD1: a childless object gets the plain wording', async ({ page }) => {
    const dialog = await openDeleteDialog(page, ALONE)

    await expect(dialog).toContainText(ALONE)
    await expect(dialog).not.toContainText(/descendant/i)
  })

  test('DD2: the count is the whole subtree, not the direct children', async ({
    page,
  }) => {
    const dialog = await openDeleteDialog(page, ROOT)

    // TWO: a child and a grandchild. The row's own `childCount` is 1, so this is the assertion
    // that separates a subtree query from the cheap number already on the row.
    await expect(dialog).toContainText(/2 descendants/i)
  })

  test('DD3: the copy says the descendants survive', async ({ page }) => {
    const dialog = await openDeleteDialog(page, ROOT)

    // Delete is NOT cascading. A user who reads this as "and everything under it" would keep a
    // tree they meant to drop, or panic about one they did not.
    await expect(dialog).toContainText(/stay live/i)
  })
})
