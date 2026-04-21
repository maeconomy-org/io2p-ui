import { Page, Locator, expect } from '@playwright/test'

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
 * Wait until the upload center reports idle (all queued uploads reached a
 * terminal state). The provider renders a hidden `upload-center-idle` sentinel
 * both when the queue is empty and when every task is complete. This is the
 * reliable replacement for `waitForTimeout(3000)` around file-upload flows —
 * full page reloads abort in-flight uploads, so tests must wait for the queue
 * to drain before navigating.
 */
export async function waitForUploadsIdle(page: Page, timeout = 30_000) {
  const sentinel = page.locator('[data-testid="upload-center-idle"]').first()

  // Two-phase wait: sentinel present → settle window → still present.
  // The settle window matters because create-object flows enqueue uploads
  // via `void uploadQueue.enqueue(...)` *after* the creator toast appears.
  // If we only check once, we may catch the initial empty-queue sentinel
  // before the background upload task has been pushed, then reload and
  // abort the in-flight POST.
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await sentinel
      .waitFor({
        state: 'attached',
        timeout: Math.max(100, deadline - Date.now()),
      })
      .catch(() => {})

    // Settle window — if a new upload gets enqueued within this period,
    // the sentinel will detach and we re-enter the wait loop.
    await page.waitForTimeout(750)
    const stillAttached = (await sentinel.count()) > 0
    if (stillAttached) return
  }
}

/**
 * Open an object by double-clicking its row in the table
 */
export async function openObject(page: Page, name: string) {
  // If any background uploads are pending, wait for them before reloading.
  // Reload destroys JS context and aborts in-flight fetches, which silently
  // loses files. See e2e/02-objects/01-object-crud.spec.ts TC006.
  await waitForUploadsIdle(page)

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
 * Open the attach modal from a sheet, upload a file, click Done, and confirm
 * the upload AlertDialog if it appears.
 *
 * Uses stable `data-testid` selectors on the modal + Done button instead of
 * matching the dialog by its "Attachments" heading, which is brittle against
 * i18n / layout changes. Handles both create-sheet flows (no AlertDialog —
 * uploads happen after object creation) and edit flows (AlertDialog appears
 * because an `uploadContext` is already known).
 */
export async function attachFileInSheet(
  page: Page,
  sheet: Locator,
  file: { name: string; mime?: string; content?: string }
) {
  await sheet.getByRole('button', { name: /attach file/i }).click()

  const modal = page.locator('[data-testid="attachment-modal"]')
  await expect(modal).toBeVisible({ timeout: 5000 })

  const mimeType =
    file.mime ??
    (file.name.endsWith('.pdf')
      ? 'application/pdf'
      : file.name.endsWith('.txt')
        ? 'text/plain'
        : 'application/octet-stream')

  await modal.locator('input[type="file"]').setInputFiles({
    name: file.name,
    mimeType,
    buffer: Buffer.from(file.content ?? 'Test file content'),
  })

  await page.locator('[data-testid="attachment-modal-done-button"]').click()

  // Edit-mode flow: upload confirmation AlertDialog.
  const confirmButton = page.locator(
    '[data-testid="upload-files-confirm-button"]'
  )
  if (await confirmButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmButton.click()
  }

  await expect(modal).toBeHidden({ timeout: 5000 })
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
 * Add a property during object creation (in the sheet form).
 * Handles both first property ("Add Property") and subsequent
 * properties ("Add Another Property") with scroll support.
 */
export async function addPropertyInForm(
  sheet: ReturnType<typeof getDialog>,
  name: string,
  values: string[]
) {
  // Count existing property inputs to determine which button to use
  const beforeCount = await sheet.getByLabel('Property Name').count()

  if (beforeCount === 0) {
    await sheet.getByRole('button', { name: 'Add Property' }).click()
  } else {
    const addBtn = sheet.getByRole('button', {
      name: 'Add Another Property',
    })
    await addBtn.scrollIntoViewIfNeeded()
    await addBtn.click()
  }

  // Wait for the new property name input to appear (use data-testid
  // since getByLabel can fail when multiple labels share the same htmlFor)
  const propertyNameInputs = sheet.locator('[data-testid^="property-name-"]')
  await expect(propertyNameInputs.nth(beforeCount)).toBeVisible({
    timeout: 10000,
  })
  await propertyNameInputs.nth(beforeCount).fill(name)

  // Fill values
  for (let i = 0; i < values.length; i++) {
    const valueInputs = sheet.getByPlaceholder('Enter property value')
    const valueCount = await valueInputs.count()
    await valueInputs.nth(valueCount - 1).fill(values[i])

    // Add another value if not the last one
    if (i < values.length - 1) {
      const addValueButtons = sheet.locator(
        '[data-testid^="property-add-value-"]'
      )
      const btnCount = await addValueButtons.count()
      await addValueButtons.nth(btnCount - 1).click()
    }
  }
}
