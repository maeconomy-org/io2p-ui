import { test, expect, type Page } from '@playwright/test'
import { getDialog, addPropertyInForm, openObject } from '../utils/test-helpers'

/**
 * Backend-Team Formula Flow (Exact Reproduction)
 *
 * Mirrors the backend team's verified test case for wiring a formula onto
 * an existing object through the UI. Each step below maps 1:1 to the
 * backend flow description.
 *
 *   a) POST /api/Aggregate with UUObject + 2 properties × 1 value each
 *   b) Keep property value and UUObject UUIDs
 *   c) Make a new property and property value
 *   d) Statements between UUObject, new property and new property value
 *      (HAS_PROPERTY/IS_PROPERTY_OF + HAS_VALUE/IS_VALUE_OF — SDK auto-creates)
 *   e) Create a UUMathFormula (name, expression, version, description)
 *   f) Create a UUMathFormulaCalc: args = values from (a), result = value from (c)
 *   f**) Statement UUMathFormula → HAS_MATH_FORMULA_CALC → Calc
 *   j) Statement UUObject → HAS_MATH_FORMULA_CALC → Calc
 *      (this is what fires AggregateUUStatementsEventListener.postCreate,
 *       triggering the UUMathFormulaCreate operation that computes the value)
 *   g) AggregateEntity contains full mathFormulas metadata + computed value
 */

const runId = Date.now()
const objectName = `BEF ${runId}` // "Backend Exact Flow"
const formulaName = `e2e_bef_sum_${runId}`
const formulaExpression = 'a + b'
const formulaDescription = 'e2e backend-flow sum'
const formulaVersion = '1.0.0'

const goToPropertiesTab = async (page: Page) => {
  await page.getByRole('tab', { name: /properties/i }).click()
  await page.waitForTimeout(500)
}

const enterEditMode = async (page: Page) => {
  await page.locator('[data-testid="section-properties-edit-button"]').click()
  await page.waitForTimeout(500)
}

const clickSave = async (page: Page) => {
  await page.locator('[data-testid="section-properties-save-button"]').click()
  await page.waitForTimeout(2000)
}

const closeSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Close' }).first().click()
  await page.waitForTimeout(500)
}

/** Step (e): Ensure a UUMathFormula exists with name/expression/version/description. */
async function ensureFormula(
  page: Page,
  name: string,
  expression: string,
  description: string,
  version: string
) {
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
  await dialog.getByLabel(/version/i).fill(version)
  await dialog.getByLabel(/description/i).fill(description)
  await page.waitForTimeout(300)

  await dialog.getByRole('button', { name: /create formula/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10000 })
}

test.describe('15 - Formula Backend-Team Exact Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('Setup (e): Create UUMathFormula', async ({ page }) => {
    test.slow()
    await ensureFormula(
      page,
      formulaName,
      formulaExpression,
      formulaDescription,
      formulaVersion
    )
  })

  test('Steps (a,b): Create UUObject with 2 properties × 1 value via Aggregate', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    // (a) POST /api/Aggregate fired by the Create Object sheet.
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(objectName)
    await addPropertyInForm(sheet, 'Width', ['10'])
    await addPropertyInForm(sheet, 'Height', ['20'])

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // (b) UUIDs are implicit — we rely on name lookup for subsequent steps.
    await expect(page.getByText(objectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('Steps (c,d,f,f**,j,g): Add formula property → wire statements → verify aggregate', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // ─── Step (c): Add new property + value ───────────────────────
    await page
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    const lastNameInput = page.locator('[data-testid^="property-name-"]').last()
    await expect(lastNameInput).toBeVisible({ timeout: 5000 })
    await lastNameInput.fill('Total')

    // Step (d) is automatic — addPropertyToObject/setValueForProperty create
    // HAS_PROPERTY, IS_PROPERTY_OF, HAS_VALUE, IS_VALUE_OF statements.

    // Switch the new value to formula mode
    const formulaToggles = page.locator('[data-testid="value-mode-formula"]')
    const toggleCount = await formulaToggles.count()
    await formulaToggles.nth(toggleCount - 1).click()
    await page.waitForTimeout(300)

    // Pick the formula created in setup
    await page.getByText('Select a formula').click()
    await page.waitForTimeout(500)

    const searchInput = page.locator('[cmdk-input]')
    await expect(searchInput).toBeVisible({ timeout: 3000 })
    await searchInput.fill(formulaName)
    await page.waitForTimeout(300)

    await page.getByText(formulaName).first().click()
    await page.waitForTimeout(1000)

    // ─── Step (f): Map args → existing property values (a=Width, b=Height)
    await expect(page.getByText('Variable Mapping').last()).toBeVisible({
      timeout: 5000,
    })

    const mappingRows = page.locator('.rounded-md.border.bg-muted\\/30')

    const aRow = mappingRows.filter({ hasText: 'a' }).last()
    await aRow.locator('[role="combobox"]').scrollIntoViewIfNeeded()
    await aRow.locator('[role="combobox"]').click()
    await page.waitForTimeout(500)
    await page
      .locator('[role="option"]')
      .filter({ hasText: 'Width' })
      .first()
      .click()
    await page.waitForTimeout(500)

    const bRow = mappingRows.filter({ hasText: 'b' }).last()
    await bRow.locator('[role="combobox"]').scrollIntoViewIfNeeded()
    await bRow.locator('[role="combobox"]').click()
    await page.waitForTimeout(500)
    await page
      .locator('[role="option"]')
      .filter({ hasText: 'Height' })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Frontend preview (sanity check before save)
    const previewResult = page.locator('.font-bold.text-primary')
    await expect(previewResult.last()).toBeVisible({ timeout: 5000 })
    await expect(previewResult.last()).toContainText('30')

    // ─── Save triggers: create calc (f), Formula→Calc statement (f**),
    //     Object→Calc statement (j). The order f** → j is required so the
    //     listener can read formula metadata when it fires.
    await clickSave(page)
    await closeSheet(page)

    // ─── Step (g): Reopen → aggregate response must contain
    //     mathFormulas metadata AND the backend-computed value
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    const totalHeader = page
      .locator('[data-testid^="property-header-"]')
      .filter({ hasText: 'Total' })
    await expect(totalHeader).toBeVisible({ timeout: 10000 })
    await expect(totalHeader).toContainText('30')

    await totalHeader.click()
    await page.waitForTimeout(500)

    // fx badge proves mathFormulas metadata (name/expression) made it into
    // the aggregate — without step (f**) this badge would be missing.
    const fxBadge = page.locator('.bg-violet-100').first()
    await expect(fxBadge).toBeVisible({ timeout: 5000 })

    // formula-result presence proves the listener fired and computed the
    // value — without step (j) this would be empty.
    const formulaResult = page.locator('[data-testid="formula-result"]')
    await expect(formulaResult.first()).toBeVisible({ timeout: 5000 })
    await expect(formulaResult.first()).toContainText('30')

    await closeSheet(page)
  })
})
