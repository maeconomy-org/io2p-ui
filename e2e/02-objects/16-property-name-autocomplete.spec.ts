import { test, expect } from '@playwright/test'

import {
  openObject,
  goToPropertiesTab,
  enterPropertyEditMode,
  savePropertyEdits,
  closeSheet,
  getDialog,
} from '../utils/test-helpers'

/**
 * Property Name Autocomplete
 *
 * Verifies the dictionary-backed suggestion combobox on the property name
 * field: suggestions appear while typing, a pick writes the stable dictionary
 * key + localized label, freeform text is preserved verbatim, and the pick
 * survives a reload (render uses the dictionary, input shows localized label).
 */

const runId = Date.now()

test.describe('16 - Property Name Autocomplete', () => {
  test.describe.configure({ mode: 'serial' })

  const objectName = `TC-AUTO Object ${runId}`

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('shows suggestions and picks a dictionary entry on create', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(objectName)
    await sheet.getByRole('button', { name: 'Add Property' }).click()

    const nameInput = sheet.getByLabel('Property Name')
    await nameInput.fill('addr')

    // Suggestion list should appear and contain the Address entry.
    const listbox = page.locator('[data-testid="property-name-suggestions"]')
    await expect(listbox).toBeVisible({ timeout: 3000 })
    const addressOption = page.locator(
      '[data-testid="property-name-suggestion-address"]'
    )
    await expect(addressOption).toBeVisible()
    await addressOption.click()

    // After picking, the visible input value is the localized label, not the key.
    await expect(nameInput).toHaveValue('Address')

    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Amsterdam')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })
    await expect(page.getByText(objectName).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('persists localized label after reload and shows it in edit input', async ({
    page,
  }) => {
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Display mode should render the localized label, not the kebab key.
    await expect(page.getByText('Address').first()).toBeVisible({
      timeout: 5000,
    })
    // Guard against regressing to the raw dictionary key: the kebab-case key
    // "address" should never leak into display text. Exact match is required
    // because Playwright's `getByText` is case-insensitive by default and
    // would otherwise match the localized label "Address".
    await expect(
      page.getByText('address', { exact: true }).first()
    ).not.toBeVisible({
      timeout: 1000,
    })

    // Enter edit mode and verify the combobox shows the localized label.
    await enterPropertyEditMode(page)
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    const nameInput = page.locator('[data-testid^="property-name-"]').first()
    await expect(nameInput).toHaveValue('Address')

    await closeSheet(page)
  })

  test('freeform name (non-dictionary) is preserved verbatim', async ({
    page,
  }) => {
    const customName = `Custom-${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible({ timeout: 5000 })

    await sheet.getByLabel('Name').fill(`${objectName}-freeform`)
    await sheet.getByRole('button', { name: 'Add Property' }).click()

    const nameInput = sheet.getByLabel('Property Name')
    await nameInput.fill(customName)

    // No matching dictionary entry → no suggestion dropdown for this string.
    const noMatchOption = page.locator(
      `[data-testid="property-name-suggestion-${customName.toLowerCase()}"]`
    )
    await expect(noMatchOption).toHaveCount(0)

    await sheet.getByPlaceholder('Enter property value').first().fill('x')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    await openObject(page, `${objectName}-freeform`)
    await goToPropertiesTab(page)
    await expect(page.getByText(customName).first()).toBeVisible({
      timeout: 5000,
    })
    await closeSheet(page)
  })
})
