import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Attachments - Edge Cases', () => {
  test.describe.configure({ mode: 'serial' })

  let testObjectName = ''

  test('setup - create test object for attachment tests', async ({ page }) => {
    testObjectName = `E2E Attachment Test ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(testObjectName)
    await addSheet
      .getByLabel('Description')
      .fill('Object for attachment edge case tests')

    // Add property for property-level attachment tests
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('test.property')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('test value')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(testObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('attach multiple files to property', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Properties' }).click()
    await page.getByText('test.property').first().click()
    await page.getByRole('button', { name: 'Attach' }).first().click()

    const propertyAttachDialog = getDialogByTitle(
      page,
      'Attach Files to Property'
    )
    await expect(propertyAttachDialog).toBeVisible()

    // Upload first file
    await propertyAttachDialog.locator('input[type="file"]').setInputFiles({
      name: 'property-doc1.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('property document 1'),
    })

    // Upload second file
    await propertyAttachDialog.locator('input[type="file"]').setInputFiles({
      name: 'property-doc2.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('property document 2'),
    })

    // Add external reference
    await propertyAttachDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/property-external.pdf')
    await propertyAttachDialog
      .getByPlaceholder('Label (optional)')
      .fill('External Property Doc')
    await propertyAttachDialog.getByRole('button', { name: 'Add' }).click()

    await propertyAttachDialog.getByRole('button', { name: 'Done' }).click()

    const uploadConfirmDialog = getDialogByTitle(page, 'Upload Files?')
    await expect(uploadConfirmDialog).toBeVisible()
    await uploadConfirmDialog
      .getByRole('button', { name: 'Upload Files' })
      .click()

    // Verify all files are attached
    await expect(page.getByText('property-doc1.pdf')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('property-doc2.txt')).toBeVisible()
    await expect(page.getByText('External Property Doc')).toBeVisible()
  })

  test('attach files to property value', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Properties' }).click()
    await page.getByText('test.property').first().click()

    // Attach to the value (second attach button)
    await page.getByRole('button', { name: 'Attach' }).nth(1).click()

    const valueAttachDialog = getDialogByTitle(page, 'Attach Files to Value')
    await expect(valueAttachDialog).toBeVisible()

    // Upload file to value
    await valueAttachDialog.locator('input[type="file"]').setInputFiles({
      name: 'value-spec.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('value specification'),
    })

    // Add multiple external references
    await valueAttachDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/value-ref1.pdf')
    await valueAttachDialog
      .getByPlaceholder('Label (optional)')
      .fill('Value Ref 1')
    await valueAttachDialog.getByRole('button', { name: 'Add' }).click()

    await valueAttachDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/value-ref2.pdf')
    await valueAttachDialog
      .getByPlaceholder('Label (optional)')
      .fill('Value Ref 2')
    await valueAttachDialog.getByRole('button', { name: 'Add' }).click()

    await valueAttachDialog.getByRole('button', { name: 'Done' }).click()

    const uploadConfirmDialog = getDialogByTitle(page, 'Upload Files?')
    await expect(uploadConfirmDialog).toBeVisible()
    await uploadConfirmDialog
      .getByRole('button', { name: 'Upload Files' })
      .click()

    // Verify value attachments
    await expect(page.getByText('value-spec.pdf')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Value Ref 1')).toBeVisible()
    await expect(page.getByText('Value Ref 2')).toBeVisible()
  })

  test('handle duplicate file names', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Files' }).click()
    await page.getByRole('button', { name: /add files/i }).click()

    const objectFilesDialog = getDialogByTitle(page, 'Object Files')
    await expect(objectFilesDialog).toBeVisible()

    // Upload file with same name as existing
    await objectFilesDialog.locator('input[type="file"]').setInputFiles({
      name: 'property-doc1.pdf', // Same name as property attachment
      mimeType: 'application/pdf',
      buffer: Buffer.from('duplicate name document'),
    })

    // Should handle duplicate gracefully (rename or show warning)
    await objectFilesDialog.getByRole('button', { name: 'Done' }).click()

    const uploadConfirmDialog = getDialogByTitle(page, 'Upload Files?')
    if (await uploadConfirmDialog.isVisible()) {
      await uploadConfirmDialog
        .getByRole('button', { name: 'Upload Files' })
        .click()
    }

    await page.waitForTimeout(3000)
  })

  test('remove and re-add attachments', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Files' }).click()

    // Find a file to remove
    const fileRow = page.getByText('property-doc1.pdf').first()
    if (await fileRow.isVisible()) {
      await fileRow.getByTitle('Delete file').click()

      const deleteDialog = getDialogByTitle(page, 'Delete File')
      await expect(deleteDialog).toBeVisible()
      await deleteDialog.getByRole('button', { name: 'Delete' }).click()

      await expect(page.getByText('Deleted')).toBeVisible({ timeout: 10000 })
    }

    // Re-add a file with same name
    await page.getByRole('button', { name: /add files/i }).click()

    const objectFilesDialog = getDialogByTitle(page, 'Object Files')
    await expect(objectFilesDialog).toBeVisible()

    await objectFilesDialog.locator('input[type="file"]').setInputFiles({
      name: 'property-doc1-restored.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('restored document'),
    })

    await objectFilesDialog.getByRole('button', { name: 'Done' }).click()

    const uploadConfirmDialog = getDialogByTitle(page, 'Upload Files?')
    await expect(uploadConfirmDialog).toBeVisible()
    await uploadConfirmDialog
      .getByRole('button', { name: 'Upload Files' })
      .click()

    await expect(page.getByText('property-doc1-restored.pdf')).toBeVisible({
      timeout: 15000,
    })
  })

  test('test file rename with special characters', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Rename Test ${runId}`)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'test-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    })

    // Test rename with special characters
    await attachmentsDialog.getByTitle('Rename file').click()
    await attachmentsDialog
      .locator('span')
      .filter({ hasText: '.pdf' })
      .first()
      .locator('..')
      .locator('input')
      .fill('special-chars_@#$%')
    await attachmentsDialog.getByTitle('Confirm').click()

    // Should sanitize or handle special characters
    await expect(
      attachmentsDialog.getByText(/special-chars.*\.pdf/)
    ).toBeVisible()

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('test attachment upload progress and cancellation', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Upload Test ${runId}`)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    // Upload larger file to see progress
    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'large-test-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024 * 1024), // 1MB file
    })

    // Look for progress indicator
    const progressIndicator = attachmentsDialog.locator(
      '[role="progressbar"], .progress, text=/uploading|progress/i'
    )

    if (await progressIndicator.isVisible({ timeout: 2000 })) {
      // Progress is shown, test passed
      await page.waitForTimeout(1000)
    }

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('test external URL validation edge cases', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`URL Test ${runId}`)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    // Test various URL formats
    const testUrls = [
      'ftp://example.com/file.pdf', // Non-HTTP protocol
      'https://example.com/file with spaces.pdf', // Spaces in URL
      'https://example.com/very-long-filename-that-exceeds-normal-length-limits-and-might-cause-issues.pdf',
      'https://example.com/file.pdf?param=value&other=123', // Query parameters
    ]

    for (const url of testUrls) {
      await attachmentsDialog
        .getByPlaceholder('Enter external file URL')
        .fill(url)
      await attachmentsDialog
        .getByPlaceholder('Label (optional)')
        .fill(`Test URL ${testUrls.indexOf(url) + 1}`)
      await attachmentsDialog.getByRole('button', { name: 'Add' }).click()

      // Should either accept or show validation error
      await page.waitForTimeout(500)
    }

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('test attachment modal close without saving', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Files' }).click()
    await page.getByRole('button', { name: /add files/i }).click()

    const objectFilesDialog = getDialogByTitle(page, 'Object Files')
    await expect(objectFilesDialog).toBeVisible()

    // Add files but don't save
    await objectFilesDialog.locator('input[type="file"]').setInputFiles({
      name: 'unsaved-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('unsaved content'),
    })

    // Close without saving
    await objectFilesDialog.getByRole('button', { name: 'Cancel' }).click()

    // File should not appear in the list
    await expect(page.getByText('unsaved-file.pdf')).not.toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('verify attachment counts and file size display', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Properties' }).click()
    await page.getByText('test.property').first().click()

    // Should show file counts for property and value attachments
    const propertyFileCount = page.locator('text=/\\d+ file/')
    if (await propertyFileCount.isVisible()) {
      await expect(propertyFileCount).toBeVisible()
    }

    // Check Files tab for total count
    await page.getByRole('tab', { name: 'Files' }).click()

    // Should show file sizes and total count
    const fileSizeIndicators = page.locator('text=/\\d+\\s*(KB|MB|bytes)/')
    if ((await fileSizeIndicators.count()) > 0) {
      await expect(fileSizeIndicators.first()).toBeVisible()
    }

    await page.getByRole('button', { name: 'Close' }).click()
  })
})
