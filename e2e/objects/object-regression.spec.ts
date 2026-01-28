import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()
let parentObjectName = ''
let childObjectName = ''
let childObjectUpdatedName = ''
const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Regression Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('create parent object with metadata', async ({ page }) => {
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

  test('create object with address, properties, and object files', async ({
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

    const addressInput = addSheet.getByPlaceholder(
      'Search for building address...'
    )
    await addressInput.fill('Berlin')
    const addressSuggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(addressSuggestion).toBeVisible({ timeout: 10000 })
    await addressSuggestion.click()

    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('material.type')
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
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
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

  test('edit details, properties, files, relationships, and QR code', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: childObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await expect(page.getByText(childObjectName)).toBeVisible()

    await page.getByRole('tab', { name: 'Properties' }).click()
    await expect(page.getByText('material.type')).toBeVisible()
    await expect(page.getByText('Steel')).toBeVisible()

    await page.getByText('material.type').first().click()
    await page.getByRole('button', { name: 'Attach' }).first().click()

    const propertyAttachDialog = getDialogByTitle(
      page,
      'Attach Files to Property'
    )
    await expect(propertyAttachDialog).toBeVisible()
    await propertyAttachDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/spec.pdf')
    await propertyAttachDialog.getByPlaceholder('Label (optional)').fill('Spec')
    await propertyAttachDialog.getByRole('button', { name: 'Add' }).click()
    await propertyAttachDialog.getByRole('button', { name: 'Done' }).click()

    const uploadConfirmDialog = getDialogByTitle(page, 'Upload Files?')
    await expect(uploadConfirmDialog).toBeVisible()
    await uploadConfirmDialog
      .getByRole('button', { name: 'Upload Files' })
      .click()

    await expect(page.getByText('Spec')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Attach' }).nth(1).click()
    const valueAttachDialog = getDialogByTitle(page, 'Attach Files to Value')
    await expect(valueAttachDialog).toBeVisible()
    await valueAttachDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/value.pdf')
    await valueAttachDialog
      .getByPlaceholder('Label (optional)')
      .fill('Value Spec')
    await valueAttachDialog.getByRole('button', { name: 'Add' }).click()
    await valueAttachDialog.getByRole('button', { name: 'Done' }).click()

    const valueUploadConfirm = getDialogByTitle(page, 'Upload Files?')
    await expect(valueUploadConfirm).toBeVisible()
    await valueUploadConfirm
      .getByRole('button', { name: 'Upload Files' })
      .click()
    await expect(page.getByText('Value Spec')).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByText('material.type').first().click()

    await page.getByLabel('Property Name').first().fill('material.kind')
    await page
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Steel Updated')
    await page.getByRole('button', { name: 'Add Value' }).click()
    await page
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('Recycled Content')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('material.kind')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Steel Updated')).toBeVisible()

    await page.getByRole('tab', { name: 'Metadata' }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    childObjectUpdatedName = `${childObjectName} Updated`
    await page.getByLabel('Name').fill(childObjectUpdatedName)
    await page.getByLabel('Description').fill('Updated by regression tests')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(childObjectUpdatedName)).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('tab', { name: 'Relationships' }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page
      .getByRole('button', { name: /search for parent objects/i })
      .click()
    await page
      .getByPlaceholder('Search parent objects...')
      .fill(parentObjectName)
    await page.getByText(parentObjectName).first().click()
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

    const objectUploadConfirm = getDialogByTitle(page, 'Upload Files?')
    await expect(objectUploadConfirm).toBeVisible()
    await objectUploadConfirm
      .getByRole('button', { name: 'Upload Files' })
      .click()

    const detailsFileRow = page.getByText('details-file.pdf').first()
    await expect(detailsFileRow).toBeVisible({ timeout: 15000 })
    await detailsFileRow.getByTitle('Delete file').click()

    const deleteFileDialog = getDialogByTitle(page, 'Delete File')
    await expect(deleteFileDialog).toBeVisible()
    await deleteFileDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Deleted')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Close' }).click()

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
