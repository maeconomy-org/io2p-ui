import { test, expect, type Page } from '@playwright/test'

import {
  createObjectWithProperty,
  openObject,
  goToPropertiesTab,
  enterPropertyEditMode as enterEditMode,
  savePropertyEdits as clickSave,
  cancelPropertyEdits as clickCancel,
} from '../utils/test-helpers'

/**
 * Property Editing in Object Details Sheet
 *
 * Tests property edit mode: entering/exiting edit mode, editing names and values,
 * adding/deleting properties, cancelling changes, and adding multiple values.
 * Uses serial mode since tests share a common object.
 */

const runId = Date.now()
const objectName = `TC038 PropEdit ${runId}`
const initialPropName = 'Material'
const initialPropValue = 'Concrete'

const closeSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Close' }).first().click()
  await page.waitForTimeout(500)
}

test.describe('11 - Property Editing', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('Setup: Create object with a property', async ({ page }) => {
    await createObjectWithProperty(
      page,
      objectName,
      initialPropName,
      initialPropValue
    )

    // Verify object exists in the table
    await expect(page.getByText(objectName).first()).toBeVisible()
  })

  test('TC038: Enter and exit edit mode', async ({ page }) => {
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Verify edit button is visible in display mode
    const editButton = page.locator(
      '[data-testid="section-properties-edit-button"]'
    )
    await expect(editButton).toBeVisible({ timeout: 5000 })

    // Enter edit mode
    await enterEditMode(page)

    // Expand property to see edit UI
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Verify edit UI is visible: property name input and add value button
    await expect(
      page.locator('[data-testid^="property-name-"]').first()
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator('[data-testid^="property-add-value-"]').first()
    ).toBeVisible({ timeout: 5000 })

    // Verify save and cancel buttons are visible
    await expect(
      page.locator('[data-testid="section-properties-save-button"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="section-properties-cancel-button"]')
    ).toBeVisible()

    // Exit edit mode via cancel
    await clickCancel(page)

    // Verify display mode restored: edit button visible again
    await expect(editButton).toBeVisible({ timeout: 5000 })

    await closeSheet(page)
  })

  test('TC039: Edit property name', async ({ page }) => {
    test.slow()

    const updatedPropName = `UpdatedProp ${runId}`

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Expand property header to access the name input
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Change property name
    const nameInput = page.locator('[data-testid^="property-name-"]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.clear()
    await nameInput.fill(updatedPropName)

    // Save
    await clickSave(page)

    // Close and reopen to verify persistence
    await closeSheet(page)
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    await expect(page.getByText(updatedPropName).first()).toBeVisible({
      timeout: 10000,
    })

    await closeSheet(page)
  })

  test('TC040: Edit property value', async ({ page }) => {
    test.slow()

    const updatedValue = `Steel-${runId}`

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Expand property header
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Change value via the input placeholder
    const valueInput = page.getByPlaceholder('Enter property value').first()
    await expect(valueInput).toBeVisible({ timeout: 5000 })
    await valueInput.clear()
    await valueInput.fill(updatedValue)

    // Save
    await clickSave(page)

    // Close and reopen to verify persistence
    await closeSheet(page)
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Expand property to see value
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    await expect(page.getByText(updatedValue).first()).toBeVisible({
      timeout: 10000,
    })

    await closeSheet(page)
  })

  test('TC041: Add new property in edit mode', async ({ page }) => {
    test.slow()

    const newPropName = `Height-${runId}`
    const newPropValue = '120 meters'

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Click "Add Property" button — new property auto-expands
    await page
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.waitForTimeout(500)

    // The new property is auto-expanded, so the name input should be visible
    const lastNameInput = page.locator('[data-testid^="property-name-"]').last()
    await expect(lastNameInput).toBeVisible({ timeout: 5000 })
    await lastNameInput.fill(newPropName)

    // Fill value
    const valueInputs = page.getByPlaceholder('Enter property value')
    await valueInputs.last().fill(newPropValue)

    // Save
    await clickSave(page)

    // Verify new property appears in display mode
    await expect(page.getByText(newPropName).first()).toBeVisible({
      timeout: 10000,
    })

    await closeSheet(page)
  })

  test('TC042: Delete property with double-click confirm', async ({ page }) => {
    test.slow()

    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Count properties before delete
    const propertyHeadersBefore = page.locator(
      '[data-testid^="property-header-"]'
    )
    const countBefore = await propertyHeadersBefore.count()
    expect(countBefore).toBeGreaterThanOrEqual(2)

    await enterEditMode(page)

    // Click delete (trash icon) on the last property
    const deleteButton = page
      .locator('[data-testid^="property-delete-"]')
      .last()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()
    await page.waitForTimeout(300)

    // Verify "Confirm" button appears (the button text changes)
    const confirmButton = page
      .locator('[data-testid^="property-delete-"]')
      .last()
    await expect(confirmButton).toContainText('Confirm', { timeout: 3000 })

    // Click confirm to delete
    await confirmButton.click()
    await page.waitForTimeout(300)

    // Save
    await clickSave(page)

    // Verify property count decreased
    const propertyHeadersAfter = page.locator(
      '[data-testid^="property-header-"]'
    )
    const countAfter = await propertyHeadersAfter.count()
    expect(countAfter).toBeLessThan(countBefore)

    // Close and reopen to verify persistence
    await closeSheet(page)
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    const propertyHeadersPersisted = page.locator(
      '[data-testid^="property-header-"]'
    )
    const countPersisted = await propertyHeadersPersisted.count()
    expect(countPersisted).toBe(countAfter)

    await closeSheet(page)
  })

  test('TC043: Cancel discards changes', async ({ page }) => {
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    await enterEditMode(page)

    // Expand to access property name input
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Read the current property name from the input
    const nameInput = page.locator('[data-testid^="property-name-"]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    const originalName = await nameInput.inputValue()

    // Change property name
    await nameInput.clear()
    await nameInput.fill('ShouldBeDiscarded')

    // Cancel
    await clickCancel(page)

    // Verify original name is restored in the header
    await expect(
      page.locator('[data-testid^="property-header-"]').first()
    ).toContainText(originalName, { timeout: 5000 })

    // Verify "ShouldBeDiscarded" is NOT shown
    await expect(page.getByText('ShouldBeDiscarded')).toBeHidden({
      timeout: 3000,
    })

    await closeSheet(page)
  })

  test('TC044: Add second value to property', async ({ page }) => {
    test.slow()

    const secondValue = `Recycled-${runId}`

    await openObject(page, objectName)
    await goToPropertiesTab(page)
    await enterEditMode(page)

    // Expand property
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Click "Add" value button for the property
    const addValueButton = page
      .locator('[data-testid^="property-add-value-"]')
      .first()
    await expect(addValueButton).toBeVisible({ timeout: 5000 })
    await addValueButton.click()
    await page.waitForTimeout(300)

    // Fill the second value (the last value input)
    const valueInputs = page.getByPlaceholder('Enter property value')
    await valueInputs.last().fill(secondValue)

    // Save
    await clickSave(page)

    // Close and reopen to verify persistence
    await closeSheet(page)
    await openObject(page, objectName)
    await goToPropertiesTab(page)

    // Expand property to see values
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)

    // Verify both values are displayed
    await expect(page.getByText(secondValue).first()).toBeVisible({
      timeout: 10000,
    })

    // Verify the "values" count or both value containers are present
    const valueContainers = page.locator('[data-testid^="property-value-"]')
    const valueCount = await valueContainers.count()
    expect(valueCount).toBeGreaterThanOrEqual(2)

    await closeSheet(page)
  })
})
