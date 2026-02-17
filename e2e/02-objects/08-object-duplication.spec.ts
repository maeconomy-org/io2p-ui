import { test, expect, type Page } from '@playwright/test'

/**
 * Object Duplication Tests
 *
 * Covers:
 * - TC001: Duplicate object from table row (single object, no children)
 * - TC002: Duplicate object with children (recursive copy)
 * - TC003: "Copy Here" functionality from child page header
 */

const runId = Date.now()
const getDialog = (page: Page, title: RegExp | string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('08 - Object Duplication', () => {
  test.describe.configure({ mode: 'serial' })

  const parentName = `Dup Parent ${runId}`
  const childName = `Dup Child ${runId}`

  test.beforeAll(async ({ browser }) => {
    // Setup: Create a parent and child object for testing recursive copy
    const page = await browser.newPage()
    await page.goto('/objects')

    // Create Parent
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()
    await sheet.getByLabel('Name').fill(parentName)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden()

    // Create Child
    await page.getByRole('button', { name: /create object/i }).click()
    await expect(sheet).toBeVisible()
    await sheet.getByLabel('Name').fill(childName)

    // Select Parent
    await sheet.locator('text=/search.*parent/i').click()
    await page.getByPlaceholder(/search.*parent/i).fill(parentName)
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: parentName })
      .first()
      .click()

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden()

    await page.close()
  })

  test('TC001: Duplicate object from table row', async ({ page }) => {
    const objectName = `Simple Object ${runId}`
    const copyName = `Copy of ${objectName}`

    // Create simple object
    await page.goto('/objects')
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await sheet.getByLabel('Name').fill(objectName)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden()

    // Find and duplicate
    const row = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(row).toBeVisible()

    await row.locator('[data-testid="object-copy-button"]').click()

    const copySheet = getDialog(page, /copy object/i)
    await expect(copySheet).toBeVisible()

    // Configure copy
    await copySheet.getByLabel('Name Prefix').fill('Copy of ')
    await copySheet.getByRole('button', { name: 'Copy' }).click()
    await expect(copySheet).toBeHidden()

    // Verify copy exists
    await expect(page.getByText(copyName)).toBeVisible({ timeout: 10000 })
  })

  test('TC002: Duplicate object with children (recursive)', async ({
    page,
  }) => {
    await page.goto('/objects')

    // Find parent object
    const row = page.locator('tbody tr').filter({ hasText: parentName }).first()
    await expect(row).toBeVisible()

    // Click duplicate
    await row.locator('[data-testid="object-copy-button"]').click()

    const copySheet = getDialog(page, /copy object/i)
    await expect(copySheet).toBeVisible()

    // Toggle include children
    await copySheet.getByLabel(/include children/i).check()

    // Verify child count badge appears
    await expect(copySheet.getByText(/1 child object/)).toBeVisible()

    await copySheet.getByLabel('Name Prefix').fill('Recursive Copy of ')
    await copySheet.getByRole('button', { name: 'Copy' }).click()
    await expect(copySheet).toBeHidden()

    // Verify parent copy exists
    const copyParentName = `Recursive Copy of ${parentName}`
    await expect(page.getByText(copyParentName)).toBeVisible({ timeout: 10000 })

    // Setup verification for child copy
    // We need to check if the child was actually copied and linked to the new parent
    // Navigate to the new parent's children page
    const newParentRow = page
      .locator('tbody tr')
      .filter({ hasText: copyParentName })
      .first()
    await newParentRow.dblclick()

    const copyChildName = `Recursive Copy of ${childName}`
    await expect(page.getByText(copyChildName)).toBeVisible({ timeout: 10000 })
  })

  test('TC003: "Copy Here" from child page header', async ({ page }) => {
    // Navigate to parent page
    await page.goto('/objects')
    const row = page.locator('tbody tr').filter({ hasText: parentName }).first()
    await row.dblclick()

    await expect(page.getByRole('heading', { name: parentName })).toBeVisible()

    // Click "Copy Here" in header
    await page.locator('[data-testid="page-header-copy-button"]').click()

    const copySheet = getDialog(page, /copy objects/i)
    await expect(copySheet).toBeVisible()

    // Search for an object to copy into this parent
    // We'll reuse the "Simple Object" from TC001
    const sourceName = `Simple Object ${runId}`
    await copySheet.getByRole('combobox').click()
    await page.getByPlaceholder(/search.*objects/i).fill(sourceName)

    // Select object
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: sourceName })
      .first()
      .click()

    // Verify it's added to selection
    await expect(copySheet.getByText(sourceName)).toBeVisible()

    // Copy
    await copySheet.getByRole('button', { name: 'Copy' }).click()
    await expect(copySheet).toBeHidden()

    // Verify it appears in the child list
    // Note: It might keep original name if prefix is empty
    await expect(page.getByText(sourceName)).toBeVisible({ timeout: 10000 })
  })
})
