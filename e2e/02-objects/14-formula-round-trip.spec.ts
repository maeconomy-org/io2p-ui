import { test, expect } from '@playwright/test'
import {
  getDialog,
  addPropertyInForm,
  openObject,
  clickTab,
} from '../utils/test-helpers'
import { E2E_ROUND_TRIP_FORMULAS } from '../utils/formula-fixtures'

/**
 * Formula Round-Trip Tests
 *
 * Verifies that the frontend formula evaluator and the backend (exp4j)
 * produce identical results for the same formula + variable values.
 *
 * Flow per test:
 * 1. Create object with numeric properties
 * 2. Add a formula property, type expression, map variables
 * 3. Assert frontend preview shows the expected result
 * 4. Save the object
 * 5. Reopen from table → Properties tab
 * 6. Assert backend-computed result matches the frontend result
 */

const runId = Date.now()

test.describe('14 - Formula Round-Trip (frontend ↔ backend)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  for (const fixture of E2E_ROUND_TRIP_FORMULAS) {
    test(`TC: ${fixture.label}`, async ({ page }) => {
      const objectName = `RT ${fixture.label} ${runId}`

      // ─── Step 1: Open create sheet ────────────────────────────
      await page.getByRole('button', { name: /create object/i }).click()
      const sheet = getDialog(page, 'Add Object')
      await expect(sheet).toBeVisible({ timeout: 5000 })

      await sheet.getByLabel('Name').fill(objectName)

      // ─── Step 2: Add numeric properties ───────────────────────
      for (const prop of fixture.properties) {
        await addPropertyInForm(sheet, prop.name, [prop.value])
      }

      // ─── Step 3: Add formula property ─────────────────────────
      await sheet.getByRole('button', { name: 'Add Property' }).click()
      const propertyNameInputs = sheet.getByLabel('Property Name')
      const propCount = await propertyNameInputs.count()
      await propertyNameInputs
        .nth(propCount - 1)
        .fill(fixture.formulaPropertyName)

      // Switch to formula mode
      const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
      const toggleCount = await formulaToggles.count()
      await formulaToggles.nth(toggleCount - 1).click()
      await page.waitForTimeout(300)

      // Type the formula expression
      const formulaInput = sheet.getByPlaceholder('e.g. x * y + 10').last()
      await expect(formulaInput).toBeVisible({ timeout: 3000 })
      await formulaInput.fill(fixture.expression)
      await page.waitForTimeout(500)

      // ─── Step 4: Map variables ────────────────────────────────
      const variableNames = Object.keys(fixture.variableMapping)
      for (const varName of variableNames) {
        const targetPropertyName = fixture.variableMapping[varName]

        // Find the variable mapping row containing this variable name badge
        const mappingRow = sheet
          .locator('.rounded-md.border.bg-muted\\/30')
          .filter({ hasText: varName })
          .last()

        // Click the select trigger within this row
        const selectTrigger = mappingRow.locator('[role="combobox"]')
        await selectTrigger.click()
        await page.waitForTimeout(300)

        // Select the option matching the target property name
        const option = page
          .locator('[role="option"]')
          .filter({ hasText: targetPropertyName })
        await option.first().click()
        await page.waitForTimeout(300)
      }

      // Wait for evaluation to complete
      await page.waitForTimeout(500)

      // ─── Step 5: Assert frontend result ───────────────────────
      // The result is displayed as bold text in the live preview section
      const resultText = sheet.locator('.font-bold.text-primary')
      await expect(resultText.last()).toBeVisible({ timeout: 5000 })
      await expect(resultText.last()).toContainText(fixture.expectedResult)

      // ─── Step 6: Save the object ──────────────────────────────
      await sheet.getByRole('button', { name: 'Create' }).click()
      await expect(sheet).toBeHidden({ timeout: 15000 })

      // Wait for the object to appear in the table
      await page.waitForTimeout(2000)

      // ─── Step 7: Reopen the object ────────────────────────────
      await openObject(page, objectName)

      // ─── Step 8: Navigate to Properties tab ───────────────────
      await clickTab(page, 'Properties')
      await page.waitForTimeout(1000)

      // ─── Step 9: Find and verify the formula property result ──
      // The formula property displays an "fx" badge next to the result
      // The result value is in a <span data-testid="formula-result">
      const formulaResult = page.locator('[data-testid="formula-result"]')
      await expect(formulaResult.first()).toBeVisible({ timeout: 10000 })
      await expect(formulaResult.first()).toContainText(fixture.expectedResult)
    })
  }
})
