import { Page, expect } from '@playwright/test'

/**
 * Common test utilities for e2e tests
 */

/**
 * Dismiss the initial login onboarding tour if it is active.
 * Sets the localStorage key so the tour won't start, and clicks
 * the driver.js close button if the overlay is already visible.
 */
export async function dismissOnboarding(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('onboarding:initial-login:v1', 'done')
  })

  // If driver.js overlay is already visible, close it
  const overlay = page.locator('.driver-popover-close-btn')
  if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await overlay.click()
    await page.waitForTimeout(300)
  }
}

/**
 * Get a dialog by its title text
 */
export const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

/**
 * Create a simple object with just a name
 */
export async function createObject(page: Page, name: string) {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })
  await sheet.getByLabel('Name').fill(name)
  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
}

/**
 * Open an object by double-clicking its row in the table
 */
export async function openObject(page: Page, name: string) {
  await page.reload()
  await page.waitForLoadState('networkidle')

  let row = page.locator('tbody tr').filter({ hasText: name }).first()

  // If not visible on first page, try searching
  if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) {
    const searchButton = page.getByRole('button', { name: /search/i }).first()
    if (await searchButton.isVisible()) {
      await searchButton.click()
      await page.getByPlaceholder(/search/i).fill(name)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
    }
    row = page.locator('tbody tr').filter({ hasText: name }).first()
  }

  await expect(row).toBeVisible({ timeout: 15000 })
  // Click "View Details" button instead of dblclick (which navigates to children)
  await row.locator('[data-testid="object-details-button"]').click()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
}

/**
 * Upload a file using the attachment modal (during object creation)
 * @param page - Playwright page
 * @param modal - The attachment modal locator
 * @param fileName - Name of the file to create
 * @param content - File content (optional)
 */
export async function uploadFileToModal(
  page: Page,
  modal: ReturnType<typeof getDialog>,
  fileName: string,
  content: string = 'Test file content'
) {
  const mimeType = fileName.endsWith('.pdf')
    ? 'application/pdf'
    : fileName.endsWith('.txt')
      ? 'text/plain'
      : 'application/octet-stream'

  await modal.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType,
    buffer: Buffer.from(content),
  })
  await page.waitForTimeout(500)
}

/**
 * Add an external file reference to an attachment modal
 */
export async function addExternalFileToModal(
  modal: ReturnType<typeof getDialog>,
  url: string,
  label?: string
) {
  await modal.getByPlaceholder('Enter external file URL').fill(url)
  if (label) {
    await modal.getByPlaceholder('Label (optional)').fill(label)
  }
  await modal.getByRole('button', { name: 'Add' }).click()
}

/**
 * Close attachment modal and confirm upload if needed
 * Uses data-testid attributes for reliable selection
 */
export async function closeAttachmentModalAndConfirm(page: Page) {
  // Click Done button using data-testid attribute
  await page
    .locator('[data-testid="attachment-modal-done-button"]')
    .last()
    .click()
  await page.waitForTimeout(500)

  // Click confirm button if upload dialog appears
  const confirmButton = page.locator(
    '[data-testid="upload-files-confirm-button"]'
  )
  if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmButton.click()
  }
}

/**
 * Handle the upload confirmation dialog (AlertDialog)
 */
export async function confirmFileUpload(page: Page) {
  const alertDialog = page.getByRole('alertdialog')
  if (await alertDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Upload Files' }).click()
  }
}

/**
 * Navigate to an object's children page by double-clicking the parent row
 */
export async function navigateToObjectChildren(page: Page, parentName: string) {
  const parentRow = page
    .locator('tbody tr')
    .filter({ hasText: parentName })
    .first()
  await expect(parentRow).toBeVisible({ timeout: 15000 })
  await parentRow.dblclick()
  await page.waitForLoadState('networkidle')
}

/**
 * Open object details sheet from children table
 */
export async function openObjectFromChildrenTable(
  page: Page,
  objectName: string
) {
  const childRow = page
    .locator('tbody tr')
    .filter({ hasText: objectName })
    .first()
  await expect(childRow).toBeVisible({ timeout: 10000 })
  const detailsButton = childRow.locator(
    '[data-testid="object-details-button"]'
  )
  await expect(detailsButton).toBeVisible({ timeout: 5000 })
  await detailsButton.click()
  await page.waitForLoadState('networkidle')
}

/**
 * Click a tab in the object details sheet
 */
export async function clickTab(page: Page, tabName: string) {
  await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click()
}

/**
 * Enter edit mode by clicking the Edit button
 */
export async function enterEditMode(page: Page) {
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.waitForTimeout(500)
}

/**
 * Save changes by clicking the Save button
 */
export async function saveChanges(page: Page) {
  await page.getByRole('button', { name: 'Save' }).click()
}

/**
 * Close the object details sheet
 */
export async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Close' }).first().click()
}

/**
 * Expand a property by clicking on it
 */
export async function expandProperty(page: Page, propertyName: string) {
  await page.getByText(propertyName).first().click()
  await page.waitForTimeout(300)
}

/**
 * Add a property during object creation (in the sheet form)
 */
export async function addPropertyInForm(
  sheet: ReturnType<typeof getDialog>,
  name: string,
  values: string[]
) {
  await sheet.getByRole('button', { name: 'Add Property' }).click()

  // Find the last property name input and fill it
  const propertyNameInputs = sheet.getByLabel('Property Name')
  const count = await propertyNameInputs.count()
  await propertyNameInputs.nth(count - 1).fill(name)

  // Fill values
  for (let i = 0; i < values.length; i++) {
    const valueInputs = sheet.getByPlaceholder('Enter property value')
    const valueCount = await valueInputs.count()
    await valueInputs.nth(valueCount - 1).fill(values[i])

    // Add another value if not the last one
    if (i < values.length - 1) {
      const addValueButtons = sheet.getByRole('button', {
        name: 'Add Another Value',
      })
      const btnCount = await addValueButtons.count()
      await addValueButtons.nth(btnCount - 1).click()
    }
  }
}
