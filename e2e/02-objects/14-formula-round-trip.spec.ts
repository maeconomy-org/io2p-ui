import { test, expect, type Page } from '@playwright/test'
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
 * 1. Create the formula on /templates (if not already exists)
 * 2. Create object with numeric properties
 * 3. Add a formula property, select formula via picker, map variables
 * 4. Assert frontend preview shows the expected result
 * 5. Save the object
 * 6. Reopen from table → Properties tab
 * 7. Assert backend-computed result matches the frontend result
 */

const runId = Date.now()

/**
 * Ensure a formula exists on the /templates page.
 * If it already exists, skip creation.
 */
async function ensureFormula(page: Page, name: string, expression: string) {
  await page.goto('/templates')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /formulas/i }).click()
  await page.waitForTimeout(500)

  // Check if the formula already exists
  const existing = page.locator('table').getByText(name, { exact: true })
  if (await existing.isVisible({ timeout: 2000 }).catch(() => false)) {
    return
  }

  await page.getByRole('button', { name: /create formula/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })

  await dialog.getByLabel(/name/i).first().fill(name)
  await dialog.locator('input.font-mono').fill(expression)
  await page.waitForTimeout(300)
  await dialog.getByRole('button', { name: /create formula/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10000 })
}

test.describe('14 - Formula Round-Trip (frontend ↔ backend)', () => {
  for (const fixture of E2E_ROUND_TRIP_FORMULAS) {
    test(`TC: ${fixture.label}`, async ({ page }) => {
      test.slow() // Round-trip tests involve formula creation + object creation + verification
      const formulaName = `rt_${fixture.formulaPropertyName}_${runId}`
      const objectName = `RT ${fixture.label} ${runId}`

      // ─── Step 1: Ensure formula exists ────────────────────────
      await ensureFormula(page, formulaName, fixture.expression)

      // ─── Step 2: Navigate to objects ──────────────────────────
      await page.goto('/objects')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

      // ─── Step 3: Open create sheet ────────────────────────────
      await page.getByRole('button', { name: /create object/i }).click()
      const sheet = getDialog(page, 'Add Object')
      await expect(sheet).toBeVisible({ timeout: 5000 })

      await sheet.getByLabel('Name').fill(objectName)

      // ─── Step 4: Add numeric properties ───────────────────────
      for (const prop of fixture.properties) {
        await addPropertyInForm(sheet, prop.name, [prop.value])
      }

      // Wait for RHF state to propagate availableProperties
      await page.waitForTimeout(500)

      // ─── Step 5: Add formula property ─────────────────────────
      const addBtn = sheet.getByRole('button', {
        name: 'Add Another Property',
      })
      await addBtn.scrollIntoViewIfNeeded()
      await addBtn.click()

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

      // Select the formula from the picker
      await sheet.getByText('Select a formula').click()
      await page.waitForTimeout(500)

      // Search for the formula
      const searchInput = page.locator('[cmdk-input]')
      await expect(searchInput).toBeVisible({ timeout: 3000 })
      await searchInput.fill(formulaName)
      await page.waitForTimeout(300)

      // Select it
      await page.getByText(formulaName).first().click()
      await page.waitForTimeout(1000)

      // ─── Step 6: Map variables ────────────────────────────────
      await expect(sheet.getByText('Variable Mapping').last()).toBeVisible({
        timeout: 5000,
      })

      // Allow RHF availableProperties to fully propagate
      await page.waitForTimeout(500)

      const variableNames = Object.keys(fixture.variableMapping)
      for (const varName of variableNames) {
        const targetPropertyName = fixture.variableMapping[varName]

        // Find the variable mapping row by stable testid
        const mappingRow = sheet
          .locator(`[data-testid="formula-variable-mapping-row-${varName}"]`)
          .last()

        // Click the select trigger within this row
        const selectTrigger = mappingRow.locator('[role="combobox"]')
        await selectTrigger.scrollIntoViewIfNeeded()
        await selectTrigger.click()
        await page.waitForTimeout(500)

        // Select the option matching the target property name
        const option = page
          .locator('[role="option"]')
          .filter({ hasText: targetPropertyName })
        await expect(option.first()).toBeVisible({ timeout: 5000 })
        await option.first().click()
        await page.waitForTimeout(500)
      }

      // Wait for evaluation to complete
      await page.waitForTimeout(500)

      // ─── Step 7: Assert frontend result ───────────────────────
      const resultText = sheet.locator('[data-testid="formula-result-preview"]')
      await expect(resultText.last()).toBeVisible({ timeout: 10000 })
      await expect(resultText.last()).toContainText(fixture.expectedResult)

      // ─── Step 8: Save the object ──────────────────────────────
      await sheet.getByRole('button', { name: 'Create' }).click()
      await expect(sheet).toBeHidden({ timeout: 15000 })

      // Wait for the object to appear in the table
      await page.waitForTimeout(2000)

      // ─── Step 9: Reopen the object ────────────────────────────
      await openObject(page, objectName)

      // ─── Step 10: Navigate to Properties tab ──────────────────
      await clickTab(page, 'Properties')
      await page.waitForTimeout(1000)

      // ─── Step 11: Verify backend-computed result ──────────────
      // Properties render collapsed by default; the summary shows `= <result>`.
      const formulaSummary = page
        .locator('[data-testid="property-summary-value"]')
        .filter({ hasText: '=' })
      await expect(formulaSummary.first()).toBeVisible({ timeout: 10000 })
      await expect(formulaSummary.first()).toContainText(fixture.expectedResult)
    })
  }
})
