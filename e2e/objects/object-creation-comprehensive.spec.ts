import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Creation - Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('create basic object with metadata', async ({ page }) => {
    const objectName = `E2E Basic Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(objectName)
    await addSheet.getByLabel('Abbreviation').fill('EBO')
    await addSheet.getByLabel('Version').fill('1.0')
    await addSheet
      .getByLabel('Description')
      .fill('Basic object created by E2E tests')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(objectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('create object with address autocomplete', async ({ page }) => {
    const objectName = `E2E Address Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(objectName)

    // Test address autocomplete
    const addressInput = addSheet.getByPlaceholder(
      'Search for building address...'
    )
    await addressInput.fill('Berlin')

    // Wait for suggestions and select first one
    const addressSuggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(addressSuggestion).toBeVisible({ timeout: 10000 })
    await addressSuggestion.click()

    // Verify address components are displayed
    await expect(addSheet.locator('text=🏘️')).toBeVisible()

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(objectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('create object with properties and values', async ({ page }) => {
    const objectName = `E2E Properties Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(objectName)

    // Add first property
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('material.type')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('Steel')

    // Add another value to the same property
    await addSheet.getByRole('button', { name: 'Add Another Value' }).click()
    await addSheet
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('Recycled')

    // Add second property
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').nth(1).fill('color')
    await addSheet.getByPlaceholder('Enter property value').nth(2).fill('Blue')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(objectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('create object with file attachments', async ({ page }) => {
    const objectName = `E2E Files Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(objectName)

    // Add file attachment
    await addSheet.getByRole('button', { name: /attach file/i }).click()
    const attachmentsDialog = getDialogByTitle(page, 'Object Attachments')
    await expect(attachmentsDialog).toBeVisible()

    // Upload file
    await attachmentsDialog.locator('input[type="file"]').setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test document content'),
    })

    // Test file rename
    await attachmentsDialog.getByTitle('Rename file').click()
    await attachmentsDialog
      .locator('span')
      .filter({ hasText: '.pdf' })
      .first()
      .locator('..')
      .locator('input')
      .fill('renamed-document')
    await attachmentsDialog.getByTitle('Confirm').click()
    await expect(
      attachmentsDialog.getByText('renamed-document.pdf')
    ).toBeVisible()

    // Add external file reference
    await attachmentsDialog
      .getByPlaceholder('Enter external file URL')
      .fill('https://example.com/external-doc.pdf')
    await attachmentsDialog
      .getByPlaceholder('Label (optional)')
      .fill('External Doc')
    await attachmentsDialog.getByRole('button', { name: 'Add' }).click()

    await attachmentsDialog.getByRole('button', { name: 'Done' }).click()

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(objectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('create object with parent relationships', async ({ page }) => {
    // First create a parent object
    const parentName = `E2E Parent ${runId}`
    await page.getByRole('button', { name: /create object/i }).click()

    let addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(parentName)
    await addSheet.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 15000 })

    // Now create child object with parent relationship
    const childName = `E2E Child ${runId}`
    await page.getByRole('button', { name: /create object/i }).click()

    addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(childName)

    // Select parent object
    await addSheet
      .getByRole('button', { name: /search for parent objects/i })
      .click()
    await addSheet.getByPlaceholder('Search parent objects...').fill(parentName)
    await addSheet.getByText(parentName).first().click()

    // Verify parent is selected
    await expect(addSheet.getByText('1 parent selected')).toBeVisible()

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(childName)).toBeVisible({
      timeout: 15000,
    })
  })
})
