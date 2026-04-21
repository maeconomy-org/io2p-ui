import { test, expect, type Page } from '@playwright/test'

/**
 * Object Formula Properties
 *
 * Tests formula mode toggle, formula selection from predefined formulas,
 * variable mapping, and live evaluation in the Add Object sheet.
 *
 * PREREQUISITE: At least one formula must exist in the system.
 * These tests use formulas created by the 08-models/03-formula-crud spec
 * or any manually created formulas.
 */

const runId = Date.now()

const getSheet = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Add Object' })

/**
 * Open the Add Object sheet and fill the name field.
 */
async function openAddObjectSheet(page: Page, objectName: string) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getSheet(page)
  await expect(sheet).toBeVisible({ timeout: 5000 })
  await sheet.getByLabel('Name').fill(objectName)
  return sheet
}

/**
 * Add a property with a text value in the Add Object form.
 */
async function addTextProperty(
  sheet: ReturnType<typeof getSheet>,
  page: Page,
  name: string,
  value: string
) {
  // Count existing property sections before adding
  const beforeCount = await sheet.getByLabel('Property Name').count()

  // Click the appropriate add button (scroll into view for long forms)
  if (beforeCount === 0) {
    await sheet.getByRole('button', { name: 'Add Property' }).click()
  } else {
    const addBtn = sheet.getByRole('button', {
      name: 'Add Another Property',
    })
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click()
  }

  // Wait for the new property input to appear
  const propInputs = sheet.getByLabel('Property Name')
  await expect(propInputs.nth(beforeCount)).toBeVisible({ timeout: 10000 })

  // Fill the new (last) property name
  await propInputs.nth(beforeCount).fill(name)

  // Fill the new (last) value input
  const valueInputs = sheet.getByPlaceholder('Enter property value')
  const vCount = await valueInputs.count()
  await valueInputs.nth(vCount - 1).fill(value)

  // Allow RHF state to propagate so availableProperties updates
  await page.waitForTimeout(500)
}

/**
 * Navigate to /templates, create a formula, then return to /objects.
 * Only call from beforeAll or a dedicated setup test to avoid per-test overhead.
 */
async function ensureFormulaExists(
  page: Page,
  name: string,
  expression: string
) {
  await page.goto('/templates')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /formulas/i }).click()
  await page.waitForTimeout(500)

  // Check if the formula already exists
  const existing = page.locator('table').getByText(name, { exact: true })
  if (await existing.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
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

  await page.goto('/objects')
  await page.waitForLoadState('networkidle')
}

test.describe('10 - Object Formula Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('TC032: Toggle between text and formula mode', async ({ page }) => {
    const sheet = await openAddObjectSheet(
      page,
      `TC032 Formula Toggle ${runId}`
    )

    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('TestProp')

    // Should start in text mode
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

    // "Select a formula" picker button should appear
    await expect(sheet.getByText('Select a formula')).toBeVisible({
      timeout: 3000,
    })

    // Text input should be gone
    await expect(
      sheet.getByPlaceholder('Enter property value').first()
    ).toBeHidden()

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

  test('TC033: Selecting a formula shows variable mapping', async ({
    page,
  }) => {
    // Ensure we have a simple formula with variables
    await ensureFormulaExists(page, 'e2e_sum', 'a + b')

    const sheet = await openAddObjectSheet(page, `TC033 Formula Vars ${runId}`)

    // Add a numeric property first
    await addTextProperty(sheet, page, 'Width', '10')

    // Add another property and switch to formula mode
    await sheet.getByRole('button', { name: 'Add Another Property' }).click()
    await page.waitForTimeout(300)
    const inputs = sheet.getByLabel('Property Name')
    const count = await inputs.count()
    await inputs.nth(count - 1).fill('Calculated')

    const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Click the formula picker to open dropdown
    await sheet.getByText('Select a formula').click()
    await page.waitForTimeout(500)

    // Select the "e2e_sum" formula from the command list
    await page.getByText('e2e_sum').first().click()
    await page.waitForTimeout(500)

    // Variable mapping section should appear
    await expect(sheet.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 5000,
    })

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC034: Formula picker shows and filters available formulas', async ({
    page,
  }) => {
    // Ensure we have a formula to find
    await ensureFormulaExists(page, 'e2e_picker', 'x * 2')

    const sheet = await openAddObjectSheet(page, `TC034 Picker ${runId}`)

    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Calc')

    // Switch to formula mode
    await sheet.locator('[data-testid="value-mode-formula"]').first().click()
    await page.waitForTimeout(300)

    // Open the formula picker
    await sheet.getByText('Select a formula').click()
    await page.waitForTimeout(500)

    // Should see a search input in the command palette
    const searchInput = page.locator('[cmdk-input]')
    await expect(searchInput).toBeVisible({ timeout: 3000 })

    // Search for our specific formula
    await searchInput.fill('e2e_picker')
    await page.waitForTimeout(300)

    // Should find it
    await expect(page.getByText('e2e_picker').first()).toBeVisible({
      timeout: 3000,
    })

    // Select it
    await page.getByText('e2e_picker').first().click()
    await page.waitForTimeout(300)

    // The picker button should now show the selected formula name
    await expect(sheet.getByText('e2e_picker')).toBeVisible({ timeout: 3000 })

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC035: Multiple properties appear in variable mapping dropdown', async ({
    page,
  }) => {
    // Ensure we have a formula with two variables
    await ensureFormulaExists(page, 'e2e_multivar', 'x + y')

    const sheet = await openAddObjectSheet(page, `TC035 MultiVal ${runId}`)

    // Add two numeric properties so both appear in variable mapping
    await addTextProperty(sheet, page, 'Width', '22')
    await addTextProperty(sheet, page, 'Height', '33')

    // Add a third property with formula mode
    const addBtnTC035 = sheet.getByRole('button', {
      name: 'Add Another Property',
    })
    await addBtnTC035.scrollIntoViewIfNeeded()
    await addBtnTC035.click()
    const propInputs = sheet.getByLabel('Property Name')
    await expect(propInputs.nth(2)).toBeVisible({ timeout: 10000 })
    await propInputs.nth(2).fill('Total')

    const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Select the formula
    await sheet.getByText('Select a formula').click()
    await page.waitForTimeout(500)
    await page.getByText('e2e_multivar').first().click()
    await page.waitForTimeout(500)

    // Variable mapping should appear for x and y
    await expect(sheet.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 5000,
    })

    // Open a variable mapping dropdown (Select trigger)
    const selectTriggers = sheet.getByText('Select property...')
    if ((await selectTriggers.count()) > 0) {
      await selectTriggers.first().click()
      await page.waitForTimeout(300)

      // Should see both properties as options
      await expect(
        page.locator('[role="option"]').filter({ hasText: 'Width' }).first()
      ).toBeVisible({ timeout: 3000 })
      await expect(
        page.locator('[role="option"]').filter({ hasText: 'Height' }).first()
      ).toBeVisible({ timeout: 3000 })

      // Press Escape to close dropdown
      await page.keyboard.press('Escape')
    }

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC036: Formula evaluation with ^ operator', async ({ page }) => {
    // Create a formula that uses the ^ operator (exp4j exponentiation)
    await ensureFormulaExists(page, 'e2e_power', '2^x')

    const sheet = await openAddObjectSheet(page, `TC036 Power Eval ${runId}`)

    // Add numeric property: Power = 10
    await addTextProperty(sheet, page, 'Power', '10')

    // Add formula property
    const addBtn = sheet.getByRole('button', {
      name: 'Add Another Property',
    })
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click()
    const inputs = sheet.getByLabel('Property Name')
    await expect(inputs.nth(1)).toBeVisible({ timeout: 5000 })
    await inputs.nth(1).fill('CalcResult')

    const formulaToggles = sheet.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Select the 2^x formula
    await sheet.getByText('Select a formula').click()
    await page.waitForTimeout(500)
    await page.getByText('e2e_power').first().click()
    await page.waitForTimeout(500)

    // Map variable x to the "Power" property
    await expect(sheet.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 5000,
    })
    await sheet.getByText('Select property...').first().click()
    await page.waitForTimeout(300)

    // Select the "Power" property option
    await page
      .locator('[role="option"]')
      .filter({ hasText: /Power/ })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Verify the result preview shows 1024 (2^10 = 1024).
    // The result renders twice (header summary + bold preview), so target the
    // bold preview to avoid a strict-mode collision.
    const resultPreview = sheet.locator('.font-bold.text-primary')
    await expect(resultPreview.last()).toBeVisible({ timeout: 5000 })
    await expect(resultPreview.last()).toContainText('1024')

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC037: Constants-only formula evaluates without variable mapping', async ({
    page,
  }) => {
    // Create a constants-only formula: log(e) = 1
    await ensureFormulaExists(page, 'e2e_const', 'log(e)')

    const sheet = await openAddObjectSheet(page, `TC037 Constants ${runId}`)

    // Add a property and switch to formula mode
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('NatLog')

    await sheet.locator('[data-testid="value-mode-formula"]').first().click()
    await page.waitForTimeout(300)

    // Select log(e) formula from the picker
    await sheet.getByText('Select a formula').click()
    await page.waitForTimeout(500)
    await page.getByText('e2e_const').first().click()
    await page.waitForTimeout(500)

    // No variable mapping should appear (log and e are built-in)
    await expect(sheet.getByText('Variable Mapping')).toBeHidden({
      timeout: 2000,
    })

    // Result preview should show 1 (natural log of e = 1)
    const resultText = sheet.locator('.font-bold.text-primary')
    await expect(resultText.last()).toBeVisible({ timeout: 5000 })
    await expect(resultText.last()).toContainText('1')

    // Close without saving
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })
})
