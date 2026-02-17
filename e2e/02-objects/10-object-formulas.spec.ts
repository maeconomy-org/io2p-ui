import { test, expect } from '@playwright/test'
import { getDialog, addPropertyInForm } from '../utils/test-helpers'

/**
 * Object Formula Properties
 *
 * Tests formula mode toggle, formula input, variable mapping,
 * and multi-value property selection in the Add Object sheet.
 */

const runId = Date.now()

test.describe('10 - Object Formula Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('TC032: Toggle between text and formula mode', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(`TC032 Formula Toggle ${runId}`)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('TestProp')

    // Should start in text mode — text toggle should have active styling
    const textToggle = sheet.locator('[data-testid="value-mode-text"]').first()
    const formulaToggle = sheet
      .locator('[data-testid="value-mode-formula"]')
      .first()

    await expect(textToggle).toBeVisible({ timeout: 3000 })
    await expect(formulaToggle).toBeVisible({ timeout: 3000 })

    // Text input should be visible
    await expect(
      sheet.getByPlaceholder('Enter property value').first()
    ).toBeVisible()

    // Switch to formula mode
    await formulaToggle.click()
    await page.waitForTimeout(300)

    // Formula input should appear (placeholder "e.g. x * y + 10")
    await expect(sheet.getByPlaceholder('e.g. x * y + 10').first()).toBeVisible(
      { timeout: 3000 }
    )

    // Switch back to text mode
    await textToggle.click()
    await page.waitForTimeout(300)

    // Text input should reappear
    await expect(
      sheet.getByPlaceholder('Enter property value').first()
    ).toBeVisible({ timeout: 3000 })

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC033: Formula editor shows variable mapping', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(`TC033 Formula Vars ${runId}`)

    // Add a property with a numeric value first
    await addPropertyInForm(sheet, 'Width', ['10'])

    // Add another property and switch to formula mode
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    const propertyNameInputs = sheet.getByLabel('Property Name')
    const count = await propertyNameInputs.count()
    await propertyNameInputs.nth(count - 1).fill('Calculated')

    // Switch last value to formula mode
    const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Type a formula with a variable
    const formulaInput = sheet.getByPlaceholder('e.g. x * y + 10').last()
    await expect(formulaInput).toBeVisible({ timeout: 3000 })
    await formulaInput.fill('x * 2')
    await page.waitForTimeout(500)

    // Variable mapping section should appear with variable "x"
    await expect(sheet.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 3000,
    })

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC034: Quick Templates dropdown shows categories', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(`TC034 Templates ${runId}`)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Calc')

    // Switch to formula mode
    await sheet.locator('[data-testid="value-mode-formula"]').first().click()
    await page.waitForTimeout(300)

    // Click Quick Templates button
    await sheet.getByRole('button', { name: /Quick Templates/i }).click()
    await page.waitForTimeout(300)

    // Should see category labels
    await expect(page.getByText('basic', { exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByText('geometry', { exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByText('finance', { exact: true })).toBeVisible({
      timeout: 3000,
    })

    // Select a template
    await page.getByText('Area (Circle)').click()
    await page.waitForTimeout(300)

    // Formula input should now contain the template formula
    const formulaInput = sheet.getByPlaceholder('e.g. x * y + 10').first()
    await expect(formulaInput).toHaveValue('PI * pow(r, 2)')

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC035: Multi-value properties appear separately in dropdown', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(`TC035 MultiVal ${runId}`)

    // Add a property with multiple numeric values
    await addPropertyInForm(sheet, 'Floors', ['22', '33'])

    // Add another property with formula mode
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    const propertyNameInputs = sheet.getByLabel('Property Name')
    const propCount = await propertyNameInputs.count()
    await propertyNameInputs.nth(propCount - 1).fill('Total')

    // Switch to formula mode
    const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Type formula
    const formulaInput = sheet.getByPlaceholder('e.g. x * y + 10').last()
    await formulaInput.fill('x + y')
    await page.waitForTimeout(500)

    // Open the first variable mapping dropdown
    const selects = sheet.locator('[role="combobox"]')
    const selectCount = await selects.count()
    // Click the last combobox (should be the variable mapping for x)
    if (selectCount > 0) {
      await selects.nth(selectCount - 2).click()
      await page.waitForTimeout(300)

      // Should see both values listed separately: "Floors – 22" and "Floors – 33"
      const options = page.locator('[role="option"]')
      const optionTexts: string[] = []
      const optCount = await options.count()
      for (let i = 0; i < optCount; i++) {
        optionTexts.push((await options.nth(i).textContent()) || '')
      }

      // At least one option should contain "Floors" and "22"
      const hasFloors22 = optionTexts.some(
        (t) => t.includes('Floors') && t.includes('22')
      )
      const hasFloors33 = optionTexts.some(
        (t) => t.includes('Floors') && t.includes('33')
      )
      expect(hasFloors22).toBe(true)
      expect(hasFloors33).toBe(true)

      // Press Escape to close dropdown
      await page.keyboard.press('Escape')
    }

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })
})
