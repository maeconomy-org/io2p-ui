import { test, expect, type Page } from '@playwright/test'

/**
 * Breadcrumbs Smoke Test
 *
 * Verifies breadcrumb navigation in deep hierarchies.
 */

const runId = Date.now()

test.describe('01 - Breadcrumbs', () => {
  test.describe.configure({ mode: 'serial' })

  const level1Name = `L1 Root ${runId}`
  const level2Name = `L2 Child ${runId}`
  const level3Name = `L3 Grandchild ${runId}`

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/objects')

    // Create Level 1
    await createObject(page, level1Name)

    // Create Level 2 (child of L1)
    await createObject(page, level2Name, level1Name)

    // Create Level 3 (child of L2)
    await createObject(page, level3Name, level2Name)

    await page.close()
  })

  test('TC001: Verify breadcrumb navigation deep hierarchy', async ({
    page,
  }) => {
    await page.goto('/objects')

    // Navigate L1 -> L2 -> L3
    await openChild(page, level1Name)
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toContainText(
      'Root'
    )
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toContainText(
      level1Name
    )

    await openChild(page, level2Name)
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toContainText(
      level1Name
    )
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toContainText(
      level2Name
    )

    // We are now at L3 context (listing children of L2, so title is L2)
    // Actually, waiting... Double click navigates into the object.
    // If I double click L1, I am at /objects/[L1_UUID]. Breadcrumb: Root / L1
    // If I double click L2 (which is in L1's list), I am at /objects/[L2_UUID]. Breadcrumb: Root / L1 / L2

    // Verify L3 is visible in the list
    await expect(page.getByText(level3Name)).toBeVisible()

    // Test navigation back via breadcrumb
    // Click "L1" in breadcrumb
    await page.getByRole('link', { name: level1Name }).click()

    // Should be back at L1 page (showing L2 in list)
    await expect(page.getByRole('heading', { name: level1Name })).toBeVisible()
    await expect(page.getByText(level2Name)).toBeVisible()

    // Click "Root" in breadcrumb
    await page.getByRole('link', { name: 'Root', exact: true }).click()
    // Check local text constant in page.tsx: t('objects.childrenPage.breadcrumbRoot') -> "Root"

    // Should be at root objects page
    await expect(
      page.getByRole('button', { name: /create object/i })
    ).toBeVisible()
    await expect(page.getByText(level1Name)).toBeVisible()
  })
})

async function createObject(page: Page, name: string, parentName?: string) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = page.getByRole('dialog').filter({ hasText: 'Add Object' })
  await expect(sheet).toBeVisible()

  await sheet.getByLabel('Name').fill(name)

  if (parentName) {
    await sheet.locator('text=/search.*parent/i').click()
    await page.getByPlaceholder(/search.*parent/i).fill(parentName)
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: parentName })
      .first()
      .click()
  }

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden()
  // Small wait to ensure creation processed
  await page.waitForTimeout(500)
}

async function openChild(page: Page, name: string) {
  const row = page.locator('tbody tr').filter({ hasText: name }).first()
  await expect(row).toBeVisible()
  await row.dblclick()
  await page.waitForLoadState('networkidle')
}
