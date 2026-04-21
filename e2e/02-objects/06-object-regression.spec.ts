import { test, expect, type Page } from '@playwright/test'

import { waitForUploadsIdle } from '../utils/test-helpers'

const runId = Date.now()
let parentObjectName = ''
let childObjectName = ''
let childObjectUpdatedName = ''
const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('06 - Object Regression Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('TC001: Create parent object with metadata', async ({ page }) => {
    test.slow()
    parentObjectName = `E2E Parent ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = page.getByRole('dialog').filter({ hasText: 'Add Object' })
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(parentObjectName)
    await addSheet
      .getByLabel('Description')
      .fill('Parent object created by E2E tests')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(parentObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('TC002: Create object with address, properties, and object files', async ({
    page,
  }) => {
    test.slow()
    childObjectName = `E2E Object ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = page.getByRole('dialog').filter({ hasText: 'Add Object' })
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(childObjectName)
    await addSheet.getByLabel('Description').fill('Object with files & values')

    const addressInput = addSheet.getByPlaceholder(/search.*address/i)
    await addressInput.fill('Berlin')
    const addressSuggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    const addressAvailable = await addressSuggestion
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    if (addressAvailable) {
      await addressSuggestion.click()
    } else {
      // Clear address field if API unavailable
      await addressInput.clear()
    }

    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('Material Type')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Steel')

    await addSheet
      .locator('[data-testid^="property-add-value-"]')
      .first()
      .click()
    await addSheet
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('Recycled')

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = page.locator('[data-testid="attachment-modal"]')
    await expect(attachmentsDialog).toBeVisible({ timeout: 5000 })

    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'object-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('object file'),
    })

    await attachmentsDialog.getByTitle('Rename file').click()
    await attachmentsDialog
      .locator('span')
      .filter({ hasText: '.pdf' })
      .first()
      .locator('..')
      .locator('input')
      .fill('object-file-renamed')
    await attachmentsDialog.getByTitle('Confirm').click()
    await expect(
      attachmentsDialog.getByText('object-file-renamed.pdf')
    ).toBeVisible()

    await attachmentsDialog
      .locator('[data-testid="attachment-modal-done-button"]')
      .click()

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(childObjectName)).toBeVisible({
      timeout: 15000,
    })

    // Wait for the background upload to drain so the next test can open the
    // object with its file already persisted.
    await waitForUploadsIdle(page)
  })

  test('TC003: Edit details, properties, files, relationships, and QR code', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: childObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.locator('[data-testid="object-details-button"]').click()

    // Wait for object details to load
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: childObjectName }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByRole('tab', { name: 'Properties' }).click()
    // Click to expand property
    await page.locator('[data-testid^="property-header-"]').first().click()
    await page.waitForTimeout(300)
    await expect(page.getByText('Steel').first()).toBeVisible()

    // Click property-level attach (paperclip icon)
    await page.locator('[data-testid^="property-attach-file-"]').first().click()

    // Property attach modal
    const propAttachModal = page.locator('[data-testid="attachment-modal"]')
    await expect(propAttachModal).toBeVisible({ timeout: 10000 })

    await propAttachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/spec.pdf')
    await propAttachModal.getByPlaceholder('Label (optional)').fill('Spec')
    await propAttachModal.getByRole('button', { name: 'Add' }).click()
    await propAttachModal.getByRole('button', { name: 'Done' }).click()

    // Confirm upload (AlertDialog)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Upload Files' }).click()

    await expect(page.getByText('Spec')).toBeVisible({ timeout: 10000 })

    // Click value-level attach (paperclip icon)
    await page.locator('[data-testid^="value-attach-file-"]').first().click()

    // Value attach modal
    const valueAttachModal = page.locator('[data-testid="attachment-modal"]')
    await expect(valueAttachModal).toBeVisible({ timeout: 10000 })

    await valueAttachModal
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/value.pdf')
    await valueAttachModal
      .getByPlaceholder('Label (optional)')
      .fill('Value Spec')
    await valueAttachModal.getByRole('button', { name: 'Add' }).click()
    await valueAttachModal.getByRole('button', { name: 'Done' }).click()

    // Confirm upload (AlertDialog)
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Upload Files' }).click()
    await expect(page.getByText('Value Spec')).toBeVisible({
      timeout: 10000,
    })

    await page.locator('[data-testid="section-properties-edit-button"]').click()
    await page.waitForTimeout(1000) // Wait for edit mode to activate

    // Edit-mode renders PropertyItemRHF with isExpanded=true by default, so
    // the property-name input is already visible. Don't click the property
    // header — that would collapse it.
    const propertyNameInput = page
      .locator('[data-testid^="property-name-"]')
      .first()
    await expect(propertyNameInput).toBeVisible({ timeout: 10000 })
    await propertyNameInput.fill('Material Kind')

    await page.getByRole('button', { name: 'Save' }).click()
    // Wait for save to complete and page to stabilize
    await page.waitForTimeout(3000)

    // Verify property name was updated (this confirms the bug fix works)
    await expect(page.getByText('Material Kind').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Metadata' }).click()
    await page.locator('[data-testid="section-metadata-edit-button"]').click()

    childObjectUpdatedName = `${childObjectName} Updated`
    await page.getByLabel('Name').fill(childObjectUpdatedName)
    await page.getByLabel('Description').fill('Updated by regression tests')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(
      page.getByRole('heading', { name: childObjectUpdatedName })
    ).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Relationships' }).click()
    await page.locator('[data-testid="section-parents-edit-button"]').click()
    await page.waitForTimeout(1000)

    // Click combobox trigger to open parent selector - use button role or placeholder
    const parentInput = page.getByPlaceholder(/search.*parent/i)
    if (await parentInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await parentInput.click()
      await parentInput.fill(parentObjectName)
    } else {
      // Try clicking a combobox button if input not directly visible
      const comboboxTrigger = page
        .locator('[role="combobox"], button:has-text(/parent/i)')
        .first()
      if (
        await comboboxTrigger.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await comboboxTrigger.click()
        await page.waitForTimeout(500)
        await page.getByPlaceholder(/search.*parent/i).fill(parentObjectName)
      }
    }
    await page.waitForTimeout(1000)
    const parentOption = page
      .locator('[cmdk-item]')
      .filter({ hasText: parentObjectName })
      .first()
    if (await parentOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await parentOption.click()
      // Close parent selector popover (modal) so Save button is clickable
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(parentObjectName)).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Files' }).click()
    await page.getByRole('button', { name: /add files/i }).click()

    const objectFilesDialog = getDialogByTitle(page, 'Files')
    await expect(objectFilesDialog).toBeVisible()
    await objectFilesDialog.locator('input[type="file"]').setInputFiles({
      name: 'details-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('details file'),
    })
    await objectFilesDialog.getByRole('button', { name: 'Done' }).click()

    // Upload confirmation dialog may or may not appear
    const objectUploadConfirm = page.getByRole('alertdialog')
    const uploadConfirmVisible = await objectUploadConfirm
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (uploadConfirmVisible) {
      await objectUploadConfirm
        .getByRole('button', { name: 'Upload Files' })
        .click()
    }

    // Wait for the background upload to drain before asserting the file row.
    await waitForUploadsIdle(page)

    // Wait for uploaded file to appear
    await expect(page.getByText('details-file.pdf').first()).toBeVisible({
      timeout: 15000,
    })
    // Find the specific file row and its delete button - use the text element's parent
    await page
      .getByText('details-file.pdf')
      .first()
      .locator('..')
      .getByTitle('Delete file')
      .click()

    // Delete File uses alertdialog role
    const deleteFileDialog = page.getByRole('alertdialog')
    await expect(deleteFileDialog).toBeVisible({ timeout: 5000 })
    await deleteFileDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('File deleted successfully')).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()

    const updatedRow = page
      .locator('tbody tr')
      .filter({ hasText: childObjectUpdatedName })
      .first()
    await expect(updatedRow).toBeVisible({ timeout: 15000 })

    const updatedUuid = (
      await updatedRow.locator('td').nth(1).innerText()
    ).trim()
    // Click dropdown menu and QR code option
    await updatedRow.locator('[data-testid="object-actions-dropdown"]').click()
    await page.getByRole('menuitem', { name: /qr code/i }).click()

    const qrDialog = getDialogByTitle(
      page,
      `QR Code for ${childObjectUpdatedName}`
    )
    await expect(qrDialog).toBeVisible()
    await expect(qrDialog.getByText(updatedUuid)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(qrDialog).toBeHidden({ timeout: 5000 })
  })
})
