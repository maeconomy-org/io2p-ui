import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

/**
 * Bulk "Set parent" — a multi-write mutation loop with no coverage at all.
 *
 * `apply()` PATCHes each selected object in turn (`bulk-parent-dialog.tsx:59-65`) rather than in
 * one request, so a failure part-way leaves the earlier ones moved. That shape is worth pinning:
 * the loop, the self-skip that stops an object becoming its own ancestor, and the fact that a
 * moved object LEAVES the root list, since `/objects` asks `parent: ''`.
 */

const runId = Date.now()
const PARENT = `e2e-${runId}-bp-parent`
const A = `e2e-${runId}-bp-a`
const B = `e2e-${runId}-bp-b`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

async function createObject(page: Page, name: string) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

async function openSetParent(page: Page, names: string[]) {
  for (const name of names) {
    await rowFor(page, name).getByRole('checkbox').check()
  }
  await expect(page.getByTestId('bulk-bar')).toBeVisible()
  await page.getByTestId('bulk-set-parent').click()
  await expect(page.getByTestId('bulk-parent-picker')).toBeVisible()
}

async function pickParent(page: Page, name: string) {
  await page.getByTestId('bulk-parent-picker').click()
  await page.getByTestId('object-picker-search').fill(name)
  const option = page
    .locator('[data-testid^="object-option-"]')
    .filter({ hasText: name })
    .first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('02 - objects list / bulk set parent', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    for (const name of [PARENT, A, B]) await createObject(page, name)
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('BP1: choosing a parent that is itself selected says it will be skipped', async ({
    page,
  }) => {
    await openSetParent(page, [A, B])
    await pickParent(page, A)

    // `apply()` `continue`s past it rather than sending a PATCH the node would reject — an object
    // cannot be its own ancestor, and the dialog says so before the user commits.
    await expect(page.getByTestId('bulk-parent-skips-self')).toBeVisible()
  })

  test('BP2: the save is disabled until a parent is chosen', async ({
    page,
  }) => {
    await openSetParent(page, [A])
    await expect(page.getByTestId('bulk-parent-save')).toBeDisabled()
    await pickParent(page, PARENT)
    await expect(page.getByTestId('bulk-parent-save')).toBeEnabled()
  })

  test('BP3: both objects move, and leave the root list', async ({ page }) => {
    await openSetParent(page, [A, B])
    await pickParent(page, PARENT)
    await page.getByTestId('bulk-parent-save').click()
    await expect(page.getByTestId('bulk-parent-picker')).toBeHidden()

    // `/objects` asks `parent: ''`, so an object that gains a parent LEAVES it. That is the
    // visible half of the move; the other half is that both arrive under the parent.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(rowFor(page, A)).toHaveCount(0)
    await expect(rowFor(page, B)).toHaveCount(0)

    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(rowFor(page, A)).toBeVisible()
    await expect(rowFor(page, B)).toBeVisible()
  })
})
