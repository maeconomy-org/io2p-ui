import { test, expect } from '@playwright/test'

import {
  attachFileInSheet,
  createObject,
  getDialog,
  openObject,
  waitForUploadsIdle,
} from '../utils/test-helpers'

/**
 * Object File Attachments
 *
 * Tests file upload, external references, and file management.
 */

const runId = Date.now()

// No cleanup needed - tests use unique timestamps

test.describe('03 - Object File Attachments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC021: Upload single file during creation', async ({ page }) => {
    const name = `TC021 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    await attachFileInSheet(page, sheet, {
      name: 'single-file.pdf',
      content: 'Single file content',
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify (openObject waits for uploads to drain before reloading)
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('single-file.pdf').first()).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC022: Upload multiple files during creation', async ({ page }) => {
    const name = `TC022 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    // Upload first file
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = page
      .getByRole('dialog')
      .filter({ hasText: /attachments/i })
    await expect(attachModal).toBeVisible({ timeout: 5000 })

    await attachModal.locator('input[type="file"]').setInputFiles({
      name: 'file1.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('File 1 content'),
    })
    await page.waitForTimeout(500)

    // Upload second file
    await attachModal.locator('input[type="file"]').setInputFiles({
      name: 'file2.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('File 2 content'),
    })
    await page.waitForTimeout(500)

    await attachModal.getByRole('button', { name: 'Done' }).click()
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify at least one file uploaded
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('file1.pdf').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC023: Add external file reference', async ({ page }) => {
    const name = `TC023 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = page
      .getByRole('dialog')
      .filter({ hasText: /attachments/i })
    await expect(attachModal).toBeVisible({ timeout: 5000 })

    await attachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/external-spec.pdf')
    await attachModal
      .getByPlaceholder('Label (optional)')
      .fill('External Specification')
    await attachModal.getByRole('button', { name: 'Add' }).click()

    await attachModal.getByRole('button', { name: 'Done' }).click()
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('External Specification').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC024: Upload file with custom label', async ({ page }) => {
    const name = `TC024 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = page
      .getByRole('dialog')
      .filter({ hasText: /attachments/i })
    await expect(attachModal).toBeVisible({ timeout: 10000 })

    // Upload file
    await attachModal.locator('input[type="file"]').setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('File content'),
    })
    await page.waitForTimeout(1000)

    // Verify file appears in attachment list
    await expect(attachModal.getByText('document.pdf')).toBeVisible({
      timeout: 5000,
    })

    await attachModal.getByRole('button', { name: 'Done' }).click()
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify file persists
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('document.pdf').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC025: Add file to existing object', async ({ page }) => {
    const name = `TC025 Object ${runId}`

    await createObject(page, name)

    // Open and add file
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()

    await page.locator('[data-testid="add-files-button"]').click()
    await page.waitForTimeout(1000)

    // Look for the modal with drag/drop area (last one is the modal, first is sheet)
    await expect(
      page.locator('[data-testid="attachment-modal"]').last()
    ).toBeVisible({ timeout: 10000 })

    // Upload file using the file input
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({
        name: 'added-later.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Added later content'),
      })
    await page.waitForTimeout(1000)

    await page
      .locator('[data-testid="attachment-modal-done-button"]')
      .last()
      .click()
    // Upload confirmation dialog should appear - wait and click confirm
    await page.waitForTimeout(500)
    await page.locator('[data-testid="upload-files-confirm-button"]').click()

    // Verify
    await expect(page.getByText('added-later.pdf').first()).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC026: Cancel file modal discards changes', async ({ page }) => {
    const name = `TC026 Object ${runId}`

    await createObject(page, name)

    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()

    await page.locator('[data-testid="add-files-button"]').click()
    await page.waitForTimeout(1000)

    // Wait for modal with drag/drop area
    await expect(
      page.locator('[data-testid="attachment-modal"]').last()
    ).toBeVisible({ timeout: 10000 })

    // Upload file
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({
        name: 'should-not-save.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Should not be saved'),
      })
    await page.waitForTimeout(1000)

    // Close modal with Escape (no Cancel button in the attachment modal)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)

    // File should NOT appear in the files tab
    await expect(page.getByText('should-not-save.pdf')).not.toBeVisible({
      timeout: 3000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC027: Add file to property (non-edit mode)', async ({ page }) => {
    const name = `TC027 Object ${runId}`

    // Create object with property
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Test Property')
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('test value')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open and attach file to property
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.waitForTimeout(500)

    // Click to expand property using data-testid
    const propertyHeader = page
      .locator('[data-testid^="property-header-"]')
      .first()
    await expect(propertyHeader).toBeVisible({ timeout: 5000 })
    await propertyHeader.click()
    await page.waitForTimeout(300)

    // Click attach button using data-testid
    const attachButton = page
      .locator('[data-testid^="property-attach-file-"]')
      .first()
    await expect(attachButton).toBeVisible({ timeout: 5000 })
    await attachButton.click()

    // Modal is visible
    const attachModal = page.locator('[data-testid="attachment-modal"]')
    await expect(attachModal).toBeVisible({ timeout: 10000 })

    // Add external reference
    await attachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/property-spec.pdf')
    await attachModal.getByPlaceholder('Label (optional)').fill('Property Spec')

    // Click Add button
    await attachModal.getByRole('button', { name: 'Add' }).click()

    // Verify the attachment was added in the modal list
    await expect(attachModal.getByText('Property Spec')).toBeVisible({
      timeout: 5000,
    })

    // Click Done button
    await attachModal.getByRole('button', { name: 'Done' }).click()

    // Confirm upload dialog (AlertDialog)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Upload Files' }).click()

    // Wait for the upload queue to drain instead of sleeping
    await waitForUploadsIdle(page)
    await expect(page.getByText('Property Spec')).toBeVisible({
      timeout: 20000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC028: Add file to property value (non-edit mode)', async ({
    page,
  }) => {
    const name = `TC028 Object ${runId}`

    // Create object with property and value
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Value File Prop')
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('value with file')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Open and attach file to property value
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.waitForTimeout(500)

    // Expand property using data-testid
    const propertyHeader = page
      .locator('[data-testid^="property-header-"]')
      .first()
    await expect(propertyHeader).toBeVisible({ timeout: 5000 })
    await propertyHeader.click()
    await page.waitForTimeout(300)

    // Wait for value item
    await expect(
      page.locator('[data-testid^="property-value-"]').first()
    ).toBeVisible({ timeout: 5000 })

    // Click attach button on the value using data-testid
    const valueAttachButton = page
      .locator('[data-testid^="value-attach-file-"]')
      .first()
    await expect(valueAttachButton).toBeVisible({ timeout: 5000 })
    await valueAttachButton.click()

    // Modal is visible
    const attachModal = page.locator('[data-testid="attachment-modal"]')
    await expect(attachModal).toBeVisible({ timeout: 10000 })

    // Add external reference to value
    await attachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/value-doc.pdf')
    await attachModal
      .getByPlaceholder('Label (optional)')
      .fill('Value Document')

    // Click Add button
    await attachModal.getByRole('button', { name: 'Add' }).click()

    // Verify the attachment was added in the modal list
    await expect(attachModal.getByText('Value Document')).toBeVisible({
      timeout: 5000,
    })

    // Click Done button
    await attachModal.getByRole('button', { name: 'Done' }).click()

    // Confirm upload dialog (AlertDialog)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Upload Files' }).click()

    // Wait for the upload queue to drain instead of sleeping
    await waitForUploadsIdle(page)
    await expect(page.getByText('Value Document')).toBeVisible({
      timeout: 20000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
