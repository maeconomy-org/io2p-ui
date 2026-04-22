import { test, expect, type Page } from '@playwright/test'
import {
  getDialog,
  addPropertyInForm,
  openObject,
  goToPropertiesTab,
  enterPropertyEditMode as enterEditMode,
  savePropertyEdits as clickSave,
  closeSheet,
} from '../utils/test-helpers'

/**
 * Formula Property Editing in Object Details Sheet
 *
 * Tests switching a property value between text and formula mode in edit mode,
 * selecting a formula, mapping variables, saving, and verifying persistence.
 * Uses serial mode since tests share a common object.
 */

const runId = Date.now()
const objectName = `TC045 FormulaEdit ${runId}`
const formulaName = `e2e_fe_sum_${runId}`

async function ensureFormula(page: Page, name: string, expression: string) {
  await page.goto('/templates')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /formulas/i }).click()
  await page.waitForTimeout(500)

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

test.describe('13 - Formula Property Editing', () => {
  test.describe.configure({ mode: 'serial' })

  test('Setup: Create formula and object with numeric properties', async ({
    page,
  }) => {
    test.slow()

    // Create formula: a + b
    await ensureFormula(page, formulaName, 'a + b')

    // Create object with two numeric properties
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(objectName)
    await addPropertyInForm(sheet, 'Width', ['10'])
    await addPropertyInForm(sheet, 'Height', ['20'])

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })
    await expect(page.getByText(objectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC045: Switch value from text to formula mode in edit mode', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Expand the first property (Width)
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Verify text mode toggle is visible
    const textToggle = page.locator('[data-testid="value-mode-text"]').first()
    const formulaToggle = page
      .locator('[data-testid="value-mode-formula"]')
      .first()
    await expect(textToggle).toBeVisible({ timeout: 5000 })
    await expect(formulaToggle).toBeVisible({ timeout: 5000 })

    // Text input should be visible initially
    await expect(
      page.getByPlaceholder('Enter property value').first()
    ).toBeVisible()

    // Switch to formula mode
    await formulaToggle.click()
    await page.waitForTimeout(300)

    // "Select a formula" picker should appear
    await expect(page.getByText('Select a formula')).toBeVisible({
      timeout: 3000,
    })

    // Text input should be gone
    await expect(
      page.getByPlaceholder('Enter property value').first()
    ).toBeHidden()

    // Switch back to text mode
    await textToggle.click()
    await page.waitForTimeout(300)

    // Text input should reappear
    await expect(
      page.getByPlaceholder('Enter property value').first()
    ).toBeVisible({ timeout: 3000 })

    await closeSheet(page)
  })

  test('TC046: Select formula and map variables in edit mode', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    // Add a third property "Total" to use as formula target
    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Add a new property
    await page
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Fill name for the new property
    const lastNameInput = page.locator('[data-testid^="property-name-"]').last()
    await expect(lastNameInput).toBeVisible({ timeout: 5000 })
    await lastNameInput.fill('Total')

    // Switch the new property's value to formula mode
    const formulaToggles = page.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Select the formula from picker
    await page.getByText('Select a formula').click()
    await page.waitForTimeout(500)

    const searchInput = page.locator('[cmdk-input]')
    await expect(searchInput).toBeVisible({ timeout: 3000 })
    await searchInput.fill(formulaName)
    await page.waitForTimeout(300)

    await page.getByText(formulaName).first().click()
    await page.waitForTimeout(1000)

    // Variable Mapping should appear
    await expect(page.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 5000,
    })

    // Map variable 'a' to Width
    const mappingRows = page.locator('.rounded-md.border.bg-muted\\/30')
    const firstRow = mappingRows.filter({ hasText: 'a' }).last()
    const firstSelect = firstRow.locator('[role="combobox"]')
    await firstSelect.scrollIntoViewIfNeeded()
    await firstSelect.click()
    await page.waitForTimeout(500)

    await page
      .locator('[role="option"]')
      .filter({ hasText: 'Width' })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Map variable 'b' to Height
    const secondRow = mappingRows.filter({ hasText: 'b' }).last()
    const secondSelect = secondRow.locator('[role="combobox"]')
    await secondSelect.scrollIntoViewIfNeeded()
    await secondSelect.click()
    await page.waitForTimeout(500)

    await page
      .locator('[role="option"]')
      .filter({ hasText: 'Height' })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Verify the formula result preview shows 30 (10 + 20)
    const resultText = page.locator('.font-bold.text-primary')
    await expect(resultText.last()).toBeVisible({ timeout: 5000 })
    await expect(resultText.last()).toContainText('30')

    // Save
    await clickSave(page)

    await closeSheet(page)
  })

  test('TC047: Formula result persists after save and reopen', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // The "Total" property header should show "30" in the summary
    const totalHeader = page
      .locator('[data-testid^="property-header-"]')
      .filter({ hasText: 'Total' })
    await expect(totalHeader).toBeVisible({ timeout: 10000 })
    await expect(totalHeader).toContainText('30')

    // Expand the Total property to see the FormulaDisplay
    await totalHeader.click()
    await page.waitForTimeout(500)

    // The formula result should be visible with the formula display
    const formulaResult = page.locator('[data-testid="formula-result"]')
    await expect(formulaResult.first()).toBeVisible({ timeout: 10000 })
    await expect(formulaResult.first()).toContainText('30')

    await closeSheet(page)
  })

  test('TC048: Formula display shows formula badge in display mode', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Expand the Total property to see the formula display
    const totalHeader = page
      .locator('[data-testid^="property-header-"]')
      .filter({ hasText: 'Total' })
    await expect(totalHeader).toBeVisible({ timeout: 10000 })
    await totalHeader.click()
    await page.waitForTimeout(500)

    // The formula property should show an "fx" badge
    const fxBadge = page.locator('.bg-violet-100').first()
    await expect(fxBadge).toBeVisible({ timeout: 5000 })

    // Verify the result is shown next to the badge
    const formulaResult = page.locator('[data-testid="formula-result"]')
    await expect(formulaResult.first()).toBeVisible({ timeout: 5000 })

    await closeSheet(page)
  })

  test('TC049: Delete formula property in edit mode', async ({ page }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Count properties before delete
    const headersBefore = page.locator('[data-testid^="property-header-"]')
    const countBefore = await headersBefore.count()
    expect(countBefore).toBeGreaterThanOrEqual(3)

    await enterEditMode(page)

    // Delete the last property (Total — the formula one)
    const deleteButton = page
      .locator('[data-testid^="property-delete-"]')
      .last()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()
    await page.waitForTimeout(300)

    // Confirm delete (double-click pattern)
    const confirmButton = page
      .locator('[data-testid^="property-delete-"]')
      .last()
    await expect(confirmButton).toContainText('Confirm', { timeout: 3000 })
    await confirmButton.click()
    await page.waitForTimeout(300)

    // Save
    await clickSave(page)

    // Verify property count decreased
    const headersAfter = page.locator('[data-testid^="property-header-"]')
    const countAfter = await headersAfter.count()
    expect(countAfter).toBeLessThan(countBefore)

    // Verify no formula result badge remains
    const formulaResult = page.locator('[data-testid="formula-result"]')
    await expect(formulaResult).toBeHidden({ timeout: 3000 })

    await closeSheet(page)
  })
})
