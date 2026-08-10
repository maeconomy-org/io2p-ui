import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openCreateSheet, sheet } from '../utils/sheet'

/**
 * §6.2 N7 — the breadcrumb trail through three levels, and each crumb navigating.
 *
 * Ported from `01-smoke/breadcrumbs.spec.ts`, whose intent survived intact while none of its
 * mechanics did: it waited on a dialog reading "Add Object" (the sheet says "Create Object" now),
 * clicked a button named "Create" (the footer is one Save), and paced itself with
 * `waitForTimeout(500)` and `networkidle`.
 *
 * The trail itself is asserted through `nav[aria-label="breadcrumb"]` — deliberately ARIA rather
 * than a testid, because that survives the production build's `data-testid` strip (§4.9).
 */

const runId = Date.now()
const L1 = `e2e-${runId}-L1`
const L2 = `e2e-${runId}-L2`
const L3 = `e2e-${runId}-L3`

const trail = (page: Page) => page.locator('nav[aria-label="breadcrumb"]')

/** Creates an object, optionally under a parent picked by name. */
async function createObject(page: Page, name: string, parentName?: string) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  if (parentName) {
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)

    // The node filters server-side and the picker renders whatever came back, so wait for the
    // option itself rather than for a request to settle.
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: parentName })
      .first()
    await expect(option).toBeVisible()
    await option.click()

    // Close the popover so the footer is clickable again.
    await page.keyboard.press('Escape')
  }

  await page.getByTestId('sheet-save').click()
  await expect(sheet(page)).toBeHidden()
}

/** Double-click navigates INTO an object; the Details button opens its sheet (L9). */
async function openChild(page: Page, name: string) {
  const row = page
    .getByTestId('data-table-row')
    .filter({ hasText: name })
    .first()
  await expect(row).toBeVisible()
  await row.dblclick()
  await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
}

test.describe('01 - navigation / breadcrumbs', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await createObject(page, L1)
    await createObject(page, L2, L1)
    await createObject(page, L3, L2)

    await page.close()
  })

  test('N7: the trail builds through three levels and each crumb navigates back', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await openChild(page, L1)
    await expect(trail(page)).toContainText('Root')
    await expect(trail(page)).toContainText(L1)

    await openChild(page, L2)
    await expect(trail(page)).toContainText(L1)
    await expect(trail(page)).toContainText(L2)

    // The third level exists as a child of L2 rather than as another hop — the point of the
    // fixture is a trail deeper than the two crumbs a single navigation produces.
    await expect(page.getByText(L3)).toBeVisible()

    // Each crumb is a link, and clicking one goes back to that level rather than just truncating
    // the trail — the failure worth catching is a crumb that renders and does nothing.
    await page.getByRole('link', { name: L1 }).click()
    await expect(page.getByRole('heading', { name: L1 })).toBeVisible()
    await expect(page.getByText(L2)).toBeVisible()

    await page.getByRole('link', { name: 'Root', exact: true }).click()
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByText(L1).first()).toBeVisible()
  })
})
