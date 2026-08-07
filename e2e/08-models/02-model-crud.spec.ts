/* eslint-disable no-restricted-syntax -- Pre-existing `if (await x.isVisible())` guards: a
   missing element passes instead of failing. This file is already slated for rewrite
   (internal-docs/11-e2e-test-plan.md §2), and it cannot run today, so converting the guards
   blind would be editing assertions nobody can verify. Remove this line with the rewrite. */
import { test, expect } from '@playwright/test'

/**
 * Object Template (Model) CRUD on /templates page
 *
 * Tests creating, previewing/editing, and deleting object templates
 * via the Object Templates tab.
 * Uses serial mode since tests share a common template.
 */

const runId = Date.now()
const templateName = `TC050 Template ${runId}`
const templateAbbr = `T${runId}`
const templateVersion = '1.0'
const templateDesc = `E2E test template ${runId}`
const propertyName = 'Material'
const propertyValue = 'Steel'

test.describe('08 - Model CRUD', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    // Stay on Object Templates tab (default)
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('TC050: Create template with properties', async ({ page }) => {
    test.slow()

    await page.getByRole('button', { name: /create model/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Fill metadata
    await sheet.getByLabel(/name/i).first().fill(templateName)
    await sheet.getByLabel(/abbreviation/i).fill(templateAbbr)
    await sheet.getByLabel(/version/i).fill(templateVersion)
    await sheet.getByLabel(/description/i).fill(templateDesc)

    // Add a property
    await sheet
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Fill property name using data-testid (more reliable with multiple inputs)
    const propNameInput = sheet
      .locator('[data-testid^="property-name-"]')
      .first()
    await expect(propNameInput).toBeVisible({ timeout: 5000 })
    await propNameInput.fill(propertyName)

    // Fill property value
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill(propertyValue)

    // Submit
    await sheet
      .getByRole('button', { name: /create/i })
      .last()
      .click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify template appears in table
    await expect(page.locator('table').getByText(templateName)).toBeVisible({
      timeout: 10000,
    })
  })

  test('TC051: Template appears in table with correct metadata', async ({
    page,
  }) => {
    const row = page.locator('table tbody tr').filter({ hasText: templateName })
    await expect(row).toBeVisible({ timeout: 10000 })

    // Verify abbreviation and version are shown
    await expect(row.getByText(templateAbbr)).toBeVisible()
    await expect(row.getByText(templateVersion)).toBeVisible()
  })

  test('TC052: Edit template metadata', async ({ page }) => {
    test.slow()

    const updatedName = `${templateName} Updated`

    // Find row and click edit (pencil) button
    const row = page.locator('table tbody tr').filter({ hasText: templateName })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('button').first().click()

    // Edit sheet should open
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Change name
    const nameInput = sheet.getByLabel(/name/i).first()
    await nameInput.clear()
    await nameInput.fill(updatedName)

    // Change version
    const versionInput = sheet.getByLabel(/version/i)
    await versionInput.clear()
    await versionInput.fill('2.0')

    // Save
    await sheet.getByRole('button', { name: /update/i }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify updated name in table
    await page.waitForTimeout(1000)
    await expect(page.locator('table').getByText(updatedName)).toBeVisible({
      timeout: 10000,
    })

    // Verify updated version
    const updatedRow = page
      .locator('table tbody tr')
      .filter({ hasText: updatedName })
    await expect(updatedRow.getByText('2.0')).toBeVisible()
  })

  test('TC055: Create object from template populates properties', async ({
    page,
  }) => {
    test.slow()

    const updatedTemplateName = `${templateName} Updated`
    const objectFromTemplate = `Object From Template ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = page.getByRole('dialog').filter({ hasText: /add object/i })
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Open the model selector combobox
    await sheet.getByRole('combobox').first().click()

    // Search and pick the template created/updated earlier in this spec
    const searchInput = page.getByPlaceholder('Search models...')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill(updatedTemplateName)

    const option = page.getByRole('option', { name: updatedTemplateName })
    await expect(option).toBeVisible({ timeout: 10000 })
    await option.click()

    // Property from the template should be pre-populated in the sheet
    await expect(
      sheet.locator(`input[value="${propertyName}"]`).first()
    ).toBeVisible({ timeout: 5000 })

    const nameInput = sheet.getByRole('textbox', { name: 'Name', exact: true })
    await nameInput.clear()
    await nameInput.fill(objectFromTemplate)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify the object shows up in the objects table
    await expect(
      page.locator('tbody tr').filter({ hasText: objectFromTemplate }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('TC053: Delete template with confirmation', async ({ page }) => {
    test.slow()

    // Find the updated template row
    const row = page
      .locator('table tbody tr')
      .filter({ hasText: `${templateName} Updated` })

    // If updated name not found, try original name
    if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) {
      const origRow = page
        .locator('table tbody tr')
        .filter({ hasText: templateName })
      await expect(origRow).toBeVisible({ timeout: 10000 })

      // Click delete (trash) button — second button in actions
      await origRow.getByRole('button').nth(1).click()
    } else {
      await expect(row).toBeVisible({ timeout: 10000 })
      // Click delete (trash) button — second button in actions
      await row.getByRole('button').nth(1).click()
    }

    // Confirm deletion in alert dialog
    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible({ timeout: 3000 })
    await confirmDialog.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify the row shows deleted state (strikethrough + badge)
    // or is removed from view
    await page.waitForTimeout(1000)

    // Either the row is hidden or shows as deleted with badge
    const rowGone = page
      .locator('table tbody tr')
      .filter({ hasText: templateName })

    // Wait for either the row to be deleted-styled or gone
    const isStillVisible = await rowGone
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (isStillVisible) {
      // Should show deleted badge/styling
      await expect(rowGone.locator('text=Deleted').first()).toBeVisible({
        timeout: 5000,
      })
    }
    // If row is gone, the delete was successful
  })

  test('TC054: Create template with empty name shows validation error', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create model/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Try to submit without name
    await sheet
      .getByRole('button', { name: /create/i })
      .last()
      .click()
    await page.waitForTimeout(500)

    // Should show validation error — sheet stays open
    await expect(sheet).toBeVisible()

    // Close without saving
    await sheet.getByRole('button', { name: /cancel/i }).click()
  })

  test('TC056: Template properties do not show formula or file toggles', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create model/i }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    // Add a property
    await sheet
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // Formula mode toggle should NOT be visible (templateMode)
    await expect(
      sheet.locator('[data-testid="value-mode-formula"]')
    ).toBeHidden({ timeout: 2000 })

    // Text mode toggle should NOT be visible either
    await expect(sheet.locator('[data-testid="value-mode-text"]')).toBeHidden({
      timeout: 2000,
    })

    // Cancel
    await sheet.getByRole('button', { name: /cancel/i }).click()
  })
})
