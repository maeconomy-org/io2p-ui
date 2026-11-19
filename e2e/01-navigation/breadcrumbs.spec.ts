import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

const runId = Date.now()
const L1 = `e2e-${runId}-L1`
const L2 = `e2e-${runId}-L2`
const L3 = `e2e-${runId}-L3`

const trail = (page: Page) => page.locator('nav[aria-label="breadcrumb"]')

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

    await expect(page.getByText(L3)).toBeVisible()

    // the trail — the failure worth catching is a crumb that renders and does nothing.
    await page.getByRole('link', { name: L1 }).click()
    await expect(page.getByRole('heading', { name: L1 })).toBeVisible()
    await expect(page.getByText(L2)).toBeVisible()

    await page.getByRole('link', { name: 'Root', exact: true }).click()
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByText(L1).first()).toBeVisible()
  })
})
