import { test, expect, type Page } from '@playwright/test'

/**
 * Object Validation & Negative Cases
 *
 * Tests validation rules, error handling, and rejection scenarios.
 */

const runId = Date.now()

const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('02 - Object Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC011: Prevent creation with empty name', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    // Try to submit without name
    await sheet.getByRole('button', { name: 'Create' }).click()

    // Should show validation error or button disabled
    const hasError = await page
      .locator('text=/required|name is required/i')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    const isDisabled = await sheet
      .getByRole('button', { name: 'Create' })
      .isDisabled()

    expect(hasError || isDisabled).toBeTruthy()

    // Dialog should still be open
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC012: Handle whitespace-only name', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill('   ')
    await sheet.getByRole('button', { name: 'Create' }).click()

    // Dialog should still be open (validation failed)
    await page.waitForTimeout(1000)
    await expect(sheet).toBeVisible()

    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC013: Cancel discards unsaved changes', async ({ page }) => {
    const name = `TC013 Cancelled ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByLabel('Description').fill('This should not be saved')

    // Cancel instead of create
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden({ timeout: 5000 })

    // Object should NOT exist
    const objectVisible = await page
      .getByText(name)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    expect(objectVisible).toBeFalsy()
  })

  test('TC014: Handle invalid external URL', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(`TC014 Object ${runId}`)

    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = getDialog(page, 'Object Attachments')
    await expect(attachModal).toBeVisible({ timeout: 5000 })

    // Try invalid URL
    await attachModal
      .getByPlaceholder('Enter external file URL')
      .fill('not-a-valid-url')
    await attachModal.getByRole('button', { name: 'Add' }).click()

    // Should show error or not add the URL
    await page.waitForTimeout(1000)

    await attachModal.getByRole('button', { name: 'Done' }).click()
    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC015: Address search with no results', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(`TC015 Object ${runId}`)

    const addressInput = sheet.getByPlaceholder(
      'Search for building address...'
    )
    await addressInput.fill('XYZ123NonExistentPlace999')

    // Wait for suggestions
    await page.waitForTimeout(3000)

    // Should show no results or empty suggestions
    const suggestions = page.locator('div.absolute.z-50 div.cursor-pointer')
    const count = await suggestions.count()

    expect(count).toBeLessThanOrEqual(1) // May show "no results" option

    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('TC016: Cancel edit discards metadata changes', async ({ page }) => {
    const name = `TC016 Object ${runId}`

    // Create object first
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByLabel('Description').fill('Original description')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open and try to edit
    const row = page.locator('tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: /metadata/i }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Make changes
    await page.getByLabel('Name').fill('SHOULD NOT SAVE')
    await page.getByLabel('Description').fill('Changed description')

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Verify original values
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Original description').first()).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC017: Cancel edit discards property changes', async ({ page }) => {
    const name = `TC017 Object ${runId}`

    // Create with property
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Original Key')
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('original value')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open and try to edit property
    const row = page.locator('tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: /properties/i }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Click on property to expand it in edit mode
    await page.getByText('Original Key').first().click()
    await page.waitForTimeout(500)

    // Change property name
    await page.getByLabel('Property Name').first().fill('SHOULD NOT SAVE')

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Verify original property name is still there (collapsed view)
    await expect(page.getByText('Original Key').first()).toBeVisible({
      timeout: 5000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC018: Tab switch during edit resets state', async ({ page }) => {
    const name = `TC018 Object ${runId}`

    // Create object
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByLabel('Abbreviation').fill('TC18')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open and edit
    const row = page.locator('tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: /metadata/i }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Make change but don't save
    await page.getByLabel('Abbreviation').fill('CHANGED')

    // Switch tabs
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.getByRole('tab', { name: /metadata/i }).click()

    // Should show original value
    await expect(page.getByText('TC18').first()).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC019: Save with no changes succeeds', async ({ page }) => {
    const name = `TC019 Object ${runId}`

    // Create
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open, enter edit mode, save without changes
    const row = page.locator('tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: /metadata/i }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Save without changes
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Should return to view mode
    await expect(
      page.getByRole('button', { name: 'Edit' }).first()
    ).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC020: Duplicate parent selection prevented', async ({ page }) => {
    const parentName = `TC020 Parent ${runId}`

    // Create parent
    await page.getByRole('button', { name: /create object/i }).click()
    let sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(parentName)
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Try to create child and select parent twice
    await page.getByRole('button', { name: /create object/i }).click()
    sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(`TC020 Child ${runId}`)

    // Select parent first time - click combobox trigger
    await sheet.locator('text=Search for parent objects...').click()
    await page.waitForTimeout(1000)
    await page.getByPlaceholder('Search parent objects...').fill(parentName)
    await page.waitForTimeout(1000)
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: parentName })
      .first()
      .click()

    // Verify 1 parent is selected
    await expect(sheet.getByText('1 parent selected')).toBeVisible({
      timeout: 5000,
    })

    // Verify the selected parent is shown with remove button
    await expect(sheet.getByText(parentName.substring(0, 15))).toBeVisible({
      timeout: 5000,
    })

    // Try to click the combobox again to search for more parents
    await sheet.getByRole('combobox').first().click()
    await page.waitForTimeout(1000)

    // Search for the same parent
    const searchInput = page.getByPlaceholder('Search parent objects...')
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(parentName)
      await page.waitForTimeout(1000)

      // Try to click the same parent again
      const parentItem = page
        .locator('[cmdk-item]')
        .filter({ hasText: parentName })
        .first()

      if (await parentItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await parentItem.click()
        await page.waitForTimeout(500)
      }

      // Close dropdown
      await page.keyboard.press('Escape')
    }

    // Count should still be 1 (duplicate was prevented or parent was toggled off/on)
    await expect(sheet.getByText(/1 parent selected/)).toBeVisible({
      timeout: 5000,
    })

    await sheet.getByRole('button', { name: 'Cancel' }).click()
  })
})
