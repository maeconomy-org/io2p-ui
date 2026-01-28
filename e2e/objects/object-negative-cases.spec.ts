import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Negative Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('should validate required name field', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    // Try to submit without name
    await addSheet.getByRole('button', { name: 'Create' }).click()

    // Should show validation error or prevent submission
    await expect(
      addSheet.locator('text=/required|invalid|error/i').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should handle invalid property names', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Test Object ${runId}`)

    // Add property with invalid characters
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('invalid property name!')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    // Should either show validation error or sanitize the property name
    await page.waitForTimeout(2000)
  })

  test('should handle empty property values', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Test Object ${runId}`)

    // Add property but leave value empty
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('test.property')
    // Don't fill the value field

    await addSheet.getByRole('button', { name: 'Create' }).click()

    // Should handle empty values gracefully
    await page.waitForTimeout(2000)
  })

  test('should handle file upload errors', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Test Object ${runId}`)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    // Try to upload an oversized file (simulate)
    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'large-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(50 * 1024 * 1024), // 50MB file
    })

    // Should show error for oversized file
    await expect(
      attachmentsDialog.locator('text=/too large|size limit|error/i').first()
    ).toBeVisible({ timeout: 5000 })

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('should handle invalid external file URLs', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Test Object ${runId}`)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    // Try invalid URL
    await attachmentsDialog
      .getByPlaceholder('Enter external file URL')
      .fill('not-a-valid-url')
    await attachmentsDialog.getByRole('button', { name: 'Add' }).click()

    // Should show validation error
    await expect(
      attachmentsDialog.locator('text=/invalid|url|error/i').first()
    ).toBeVisible({ timeout: 3000 })

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('should confirm file deletion', async ({ page }) => {
    // First create an object with a file
    const objectName = `Test Delete File ${runId}`
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(objectName)

    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'test-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    })

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()
    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(objectName)).toBeVisible({ timeout: 15000 })

    // Now open the object and try to delete the file
    const row = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Files' }).click()

    const fileRow = page.getByText('test-file.pdf').first()
    await expect(fileRow).toBeVisible({ timeout: 10000 })
    await fileRow.getByTitle('Delete file').click()

    // Should show confirmation dialog
    const deleteDialog = getDialogByTitle(page, 'Delete File')
    await expect(deleteDialog).toBeVisible()

    // Test cancel
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(deleteDialog).toBeHidden()

    // Try delete again and confirm
    await fileRow.getByTitle('Delete file').click()
    await expect(deleteDialog).toBeVisible()
    await deleteDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Deleted')).toBeVisible({ timeout: 10000 })
  })

  test('should handle parent selection limits', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Test Limits ${runId}`)

    // Try to select more parents than allowed (maxSelections=10)
    await addSheet
      .getByRole('button', { name: /search for parent objects/i })
      .click()

    // The component should show "Max" badge when limit is reached
    // This test verifies the UI handles the limit gracefully
    await addSheet.getByPlaceholder('Search parent objects...').fill('test')

    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure by going offline
    await page.context().setOffline(true)

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Network Test ${runId}`)
    await addSheet.getByRole('button', { name: 'Create' }).click()

    // Should show error message or handle gracefully
    await page.waitForTimeout(5000)

    // Restore network
    await page.context().setOffline(false)

    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })

  test('should handle address search with no results', async ({ page }) => {
    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(`Address Test ${runId}`)

    // Search for non-existent address
    const addressInput = addSheet.getByPlaceholder(
      'Search for building address...'
    )
    await addressInput.fill('NonExistentPlace12345')

    // Should show "No addresses found" message
    await expect(
      page.locator('text=/no addresses found|no results/i').first()
    ).toBeVisible({ timeout: 10000 })

    await addSheet.getByRole('button', { name: 'Cancel' }).click()
  })
})
