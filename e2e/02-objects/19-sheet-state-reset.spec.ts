import { test, expect } from '@playwright/test'

import {
  createObjectWithProperty,
  openObject,
  goToPropertiesTab,
  enterPropertyEditMode,
} from '../utils/test-helpers'

/**
 * Regression: Object Detail Sheet must drop in-progress edits on close.
 *
 * Scenario reported: open object → Edit Properties → start typing a new
 * property name/value (do NOT save) → ESC to close → reopen the same object
 * → click Edit. Before the fix, the unsaved property row was still there.
 *
 * The fix remounts the entire sheet body on each open via an `openSession`
 * key, so every hook (`usePropertyEditor`, `useAddressManagement`,
 * `useParentManagement`, `useObjectOperations`, every tab-local `useState`,
 * and `activeEditingSection`) starts fresh. The mechanism is one-size-fits-
 * all, so the section-level coverage below (metadata, parents) locks in
 * regression protection for *every* `EditableSection` on the sheet — if a
 * future refactor accidentally hoists state out of `ObjectDetailsSheetInner`,
 * at least one of these cases will fail.
 */

const runId = Date.now()
const objectName = `TC-SheetReset ${runId}`
const initialPropName = 'Material'
const initialPropValue = 'Concrete'

test.describe('19 - Sheet state reset on close/reopen', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('Setup: create object with one property', async ({ page }) => {
    await createObjectWithProperty(
      page,
      objectName,
      initialPropName,
      initialPropValue
    )
    await expect(page.getByText(objectName).first()).toBeVisible()
  })

  test('Properties: ESC mid-edit and reopen drops the unsaved row', async ({
    page,
  }) => {
    // Open object → enter edit → add a new property row (don't fill it)
    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterPropertyEditMode(page)

    const rowCountBefore = await page
      .locator('[data-testid^="property-header-"]')
      .count()

    // Click "Add property" — uses translated label, fall back to icon button
    const addButton = page
      .getByRole('button', { name: /add property/i })
      .first()
    await addButton.click()
    await page.waitForTimeout(300)

    // A new property row should have appeared
    await expect(page.locator('[data-testid^="property-header-"]')).toHaveCount(
      rowCountBefore + 1
    )

    // ESC closes the sheet (matches the user's repro path exactly).
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Reopen the same object.
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Edit mode should be off (the Edit button is visible again, not Save).
    await expect(
      page.locator('[data-testid="section-properties-edit-button"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator('[data-testid="section-properties-save-button"]')
    ).toHaveCount(0)

    // Re-enter edit mode and verify the abandoned row is gone.
    await enterPropertyEditMode(page)
    await expect(page.locator('[data-testid^="property-header-"]')).toHaveCount(
      rowCountBefore
    )
  })

  test('Metadata: ESC mid-edit and reopen drops edit-mode flag', async ({
    page,
  }) => {
    // Open object → Metadata tab → click section Edit → ESC → reopen → assert
    // we're back to display mode (edit button visible, save/cancel hidden).
    // This guards `activeEditingSection` and `useObjectOperations.editedObject`
    // — both owned by `ObjectDetailsSheetInner` — against surviving close.
    await openObject(page, objectName)
    await page.getByRole('tab', { name: /metadata/i }).click()
    await page.waitForTimeout(300)

    await page.locator('[data-testid="section-metadata-edit-button"]').click()
    await expect(
      page.locator('[data-testid="section-metadata-save-button"]')
    ).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await openObject(page, objectName)
    await page.getByRole('tab', { name: /metadata/i }).click()
    await page.waitForTimeout(300)

    // Edit mode must be off. The save button is the unambiguous "in-edit"
    // signal; assert it's gone, then confirm the edit button is back.
    await expect(
      page.locator('[data-testid="section-metadata-save-button"]')
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="section-metadata-edit-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Formula picker: ESC mid-mode-toggle and reopen drops the formula draft', async ({
    page,
  }) => {
    // The user flips a value from text → formula mode (which surfaces the
    // formula picker), then ESCs without saving. On reopen + edit, the value
    // must be back in text mode (no picker visible). This exercises
    // `usePropertyEditor.allProperties` — specifically the per-value mode
    // field — through a different draft surface than "add new row".
    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterPropertyEditMode(page)

    // Expand the first property so the value-mode toggle is visible.
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    const formulaToggle = page
      .locator('[data-testid="value-mode-formula"]')
      .first()
    await expect(formulaToggle).toBeVisible({ timeout: 5000 })
    await formulaToggle.click()
    await page.waitForTimeout(300)

    // Picker is the unambiguous "we're in formula mode" signal.
    await expect(
      page.locator('[data-testid="formula-picker"]').first()
    ).toBeVisible({ timeout: 5000 })

    // ESC closes the sheet (the picker popover is closed; ESC bubbles to the
    // Sheet). If the picker popover happens to still be open, an extra ESC
    // is harmless.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Reopen → re-enter edit → expand the same property → assert NOT in
    // formula mode anymore. Picker absent + text input present is the proof.
    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterPropertyEditMode(page)
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid="formula-picker"]')).toHaveCount(0)
    await expect(
      page.getByPlaceholder('Enter property value').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('Parents: ESC mid-edit and reopen drops edit-mode flag', async ({
    page,
  }) => {
    // Same shape as metadata, but exercises `useParentManagement.parents`
    // and the Relationships tab's `EditableSection` for `section-parents`.
    await openObject(page, objectName)
    await page.getByRole('tab', { name: /relationships/i }).click()
    await page.waitForTimeout(300)

    await page.locator('[data-testid="section-parents-edit-button"]').click()
    await expect(
      page.locator('[data-testid="section-parents-save-button"]')
    ).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await openObject(page, objectName)
    await page.getByRole('tab', { name: /relationships/i }).click()
    await page.waitForTimeout(300)

    await expect(
      page.locator('[data-testid="section-parents-save-button"]')
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="section-parents-edit-button"]')
    ).toBeVisible({ timeout: 5000 })
  })
})
