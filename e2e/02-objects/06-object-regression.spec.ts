import { test, expect, type Page } from '@playwright/test'

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
    await expect(addressSuggestion).toBeVisible({ timeout: 10000 })
    await addressSuggestion.click()

    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('Material Type')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Steel')

    await addSheet.getByRole('button', { name: 'Add Another Value' }).click()
    await addSheet
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('Recycled')

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = page
      .getByRole('dialog')
      .filter({ hasText: /attachments/i })
    await expect(attachmentsDialog).toBeVisible()

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

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(childObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test.skip('TC003: Edit details, properties, files, relationships, and QR code', async ({
    page,
  }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: childObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    // Wait for object details to load
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: childObjectName }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByRole('tab', { name: 'Properties' }).click()
    // Click to expand property
    await page.getByText('Material Type').first().click()
    await expect(page.getByText('Steel').first()).toBeVisible()
    await page.getByRole('button', { name: 'Attach' }).first().click()

    // Property attach modal
    const propAttachModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Attach Files to Property' })
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

    await page.getByRole('button', { name: 'Attach' }).nth(1).click()

    // Value attach modal
    const valueAttachModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Attach Files to Value' })
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

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.waitForTimeout(1000) // Wait for edit mode to activate

    // Click on the property to expand it in edit mode
    await page.getByText('Material Type').first().click()
    await page.waitForTimeout(500)

    // Update property name (this tests the bug fix for property name updates)
    await page.getByLabel('Property Name').first().fill('Material Kind')

    await page.getByRole('button', { name: 'Save' }).click()
    // Wait for save to complete and page to stabilize
    await page.waitForTimeout(3000)

    // Verify property name was updated (this confirms the bug fix works)
    await expect(page.getByText('Material Kind').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Metadata' }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

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
    await page.getByRole('button', { name: 'Edit' }).first().click()
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
    }
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(parentObjectName)).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Files' }).click()
    await page.getByRole('button', { name: /add files/i }).click()

    const objectFilesDialog = getDialogByTitle(page, 'Object Files')
    await expect(objectFilesDialog).toBeVisible()
    await objectFilesDialog.locator('input[type="file"]').setInputFiles({
      name: 'details-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('details file'),
    })
    await objectFilesDialog.getByRole('button', { name: 'Done' }).click()

    // Use alertdialog role for Upload Files confirmation
    const objectUploadConfirm = page.getByRole('alertdialog')
    await expect(objectUploadConfirm).toBeVisible({ timeout: 5000 })
    await objectUploadConfirm
      .getByRole('button', { name: 'Upload Files' })
      .click()

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
    await updatedRow.getByTitle('Show QR Code').click()

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
