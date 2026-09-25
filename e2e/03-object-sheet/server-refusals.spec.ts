import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  enterEditMode,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * Refusals that come from the NODE, not from the form.
 *
 * Everything else in this folder asserts a client-side guard — the sheet returns early and nothing
 * is sent. These are the other half: the request goes out, the node says no, and the question is
 * whether the UI surfaces WHICH rule refused rather than a generic failure. `saveErrorMessage`
 * maps 422 to `objects.saveError.invalid` — "Could not save — {detail}" — so the node's own prose
 * is what the user reads.
 */

const stamp = () => `e2e-${Date.now()}`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** Sonner renders an `<li>` inside `ol[data-sonner-toaster]`; it carries no `status` role. */
const toast = (page: Page) => page.locator('[data-sonner-toaster] li')

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

test.describe('03 - object sheet / refusals from the node', () => {
  test('SR1: a parent cycle is refused, and the reason reaches the user', async ({
    page,
    consoleGuard,
  }, testInfo) => {
    testInfo.setTimeout(120_000)
    // The 422 IS the subject, so the browser logging it is the test working.
    consoleGuard.expectError(/422/)

    const runId = stamp()
    const parent = `${runId}-sr1-parent`
    const child = `${runId}-sr1-child`

    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await createObject(page, parent)
    await createObject(page, child, parent)

    // Now make the PARENT a child of its own child. The picker only filters SELF
    // (`parents-field.tsx:186`), so nothing client-side stops this — the node's `reachesUpward`
    // check is the only thing standing between the user and a cycle.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, parent))
    await enterEditMode(page)
    await switchTab(page, 'details')

    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(child)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: child })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')

    await saveSheet(page, { expectClose: false })

    // Not a generic "save failed": the node's own words name the rule, so the user learns WHY.
    await expect(toast(page)).toContainText(/cycle/i)
    // Still open, with the work intact — a refused save must not discard the edit.
    await expect(page.getByTestId('sheet-save')).toBeVisible()
  })

  test('SR2: the same picker still accepts a legitimate parent', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000)
    const runId = stamp()
    const a = `${runId}-sr2-a`
    const b = `${runId}-sr2-b`

    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await createObject(page, a)
    await createObject(page, b)

    // SR1's inversion guard. Without a save that succeeds through the same picker, SR1 would pass
    // against a build where parenting is broken outright rather than refused for cause.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, b))
    await enterEditMode(page)
    await switchTab(page, 'details')

    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(a)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: a })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')

    await saveSheet(page, { expectClose: false })
    // The badge testid carries the parent's id, which this spec never learns — match the prefix.
    await expect(
      page.locator('[data-testid^="parent-badge-"]').first()
    ).toContainText(a)
  })
})
