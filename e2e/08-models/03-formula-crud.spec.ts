import { test, expect } from '@playwright/test'
import { E2E_SYNTAX_VALID, E2E_SYNTAX_INVALID } from '../utils/formula-fixtures'

/**
 * Formula CRUD on /models page
 *
 * Tests formula creation, syntax validation (exp4j-aligned),
 * editing, and deletion via the Formulas tab.
 */

const runId = Date.now()

test.describe('08 - Formula CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/models')
    await page.waitForLoadState('networkidle')

    // Switch to the Formulas tab
    await page.getByRole('tab', { name: /formulas/i }).click()
    await page.waitForTimeout(500)
  })

  test('TC057: Create a formula', async ({ page }) => {
    await page.getByRole('button', { name: /create formula/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Fill form fields
    await sheet.getByLabel(/name/i).first().fill(`Circle Area ${runId}`)
    const expressionInput = sheet.locator('input.font-mono')
    await expressionInput.fill('pi * r^2')
    await page.waitForTimeout(300)

    // Verify valid syntax indicator
    await expect(sheet.locator('.text-green-600')).toBeVisible({
      timeout: 3000,
    })

    await sheet.getByLabel(/version/i).fill('1.0')
    await sheet.getByLabel(/description/i).fill('Area of a circle using ^')

    // Submit — button text is "Create Formula"
    await sheet.getByRole('button', { name: /create formula/i }).click()
    await expect(sheet).toBeHidden({ timeout: 10000 })

    // Verify formula appears in the table
    await expect(
      page.locator('table').getByText(`Circle Area ${runId}`)
    ).toBeVisible({ timeout: 10000 })
  })

  test('TC058: Valid syntax shows green indicator', async ({ page }) => {
    await page.getByRole('button', { name: /create formula/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    const expressionInput = sheet.locator('input.font-mono')
    const validIndicator = sheet.locator('.text-green-600')

    // Test a subset of valid expressions
    const sampled = E2E_SYNTAX_VALID.slice(0, 5)
    for (const fixture of sampled) {
      await expressionInput.clear()
      await expressionInput.fill(fixture.expression)
      await page.waitForTimeout(300)

      await expect(validIndicator).toBeVisible({
        timeout: 3000,
      })

      // Also verify the input has green border class
      await expect(expressionInput).toHaveClass(/border-green-500/, {
        timeout: 3000,
      })
    }

    // Close without saving
    await sheet.getByRole('button', { name: /cancel/i }).click()
  })

  test('TC059: Invalid/rejected syntax shows red indicator (exp4j alignment)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create formula/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    const expressionInput = sheet.locator('input.font-mono')
    const errorIndicator = sheet.locator('.text-destructive').first()

    for (const fixture of E2E_SYNTAX_INVALID) {
      await expressionInput.clear()
      await expressionInput.fill(fixture.expression)
      await page.waitForTimeout(300)

      // Should show red border and error text
      await expect(expressionInput).toHaveClass(/border-destructive/, {
        timeout: 3000,
      })
      await expect(errorIndicator).toBeVisible({ timeout: 3000 })
    }

    // Close without saving
    await sheet.getByRole('button', { name: /cancel/i }).click()
  })

  test('TC060: Edit an existing formula', async ({ page }) => {
    // First create a formula to edit
    await page.getByRole('button', { name: /create formula/i }).click()
    const createSheet = page.getByRole('dialog')
    await expect(createSheet).toBeVisible({ timeout: 5000 })

    const formulaName = `Edit Test ${runId}`
    await createSheet.getByLabel(/name/i).first().fill(formulaName)
    await createSheet.locator('input.font-mono').fill('x + y')
    await page.waitForTimeout(300)
    await createSheet.getByRole('button', { name: /create formula/i }).click()
    await expect(createSheet).toBeHidden({ timeout: 10000 })

    // Wait for the formula to appear in the table
    const row = page.locator('table tbody tr').filter({ hasText: formulaName })
    await expect(row).toBeVisible({ timeout: 10000 })

    // Click the edit (pencil) icon button — first button in the actions cell
    await row.getByRole('button').first().click()

    const editSheet = page.getByRole('dialog')
    await expect(editSheet).toBeVisible({ timeout: 5000 })

    // Change the expression
    const expressionInput = editSheet.locator('input.font-mono')
    await expressionInput.clear()
    await expressionInput.fill('x * y + 1')
    await page.waitForTimeout(300)

    // Verify valid syntax
    await expect(editSheet.locator('.text-green-600')).toBeVisible({
      timeout: 3000,
    })

    // Save — button text is "Update Formula" in edit mode
    await editSheet.getByRole('button', { name: /update formula/i }).click()
    await expect(editSheet).toBeHidden({ timeout: 10000 })

    // Verify updated expression is visible in table
    await expect(page.locator('table').getByText('x * y + 1')).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC061: Delete a formula', async ({ page }) => {
    // First create a formula to delete
    await page.getByRole('button', { name: /create formula/i }).click()
    const createSheet = page.getByRole('dialog')
    await expect(createSheet).toBeVisible({ timeout: 5000 })

    const formulaName = `Delete Test ${runId}`
    await createSheet.getByLabel(/name/i).first().fill(formulaName)
    await createSheet.locator('input.font-mono').fill('x - y')
    await page.waitForTimeout(300)
    await createSheet.getByRole('button', { name: /create formula/i }).click()
    await expect(createSheet).toBeHidden({ timeout: 10000 })

    // Wait for the formula to appear
    const row = page.locator('table tbody tr').filter({ hasText: formulaName })
    await expect(row).toBeVisible({ timeout: 10000 })

    // Click the delete (trash) icon button — second button in the actions cell
    await row.getByRole('button').nth(1).click()

    // Confirm deletion in the confirmation dialog
    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible({ timeout: 3000 })
    await confirmDialog.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify formula is removed from table
    await expect(row).toBeHidden({ timeout: 10000 })
  })
})
