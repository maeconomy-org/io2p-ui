import { test, expect, type Page } from '@playwright/test'

const runId = Date.now()

const getDialogByTitle = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

test.describe('Object Editing', () => {
  test.describe.configure({ mode: 'serial' })

  let testObjectName = ''

  test('setup - create test object', async ({ page }) => {
    testObjectName = `E2E Edit Test ${runId}`

    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(testObjectName)
    await addSheet.getByLabel('Description').fill('Object for editing tests')

    // Add initial property
    await addSheet.getByRole('button', { name: 'Add Property' }).click()
    await addSheet.getByLabel('Property Name').fill('initial.property')
    await addSheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('initial value')

    await addSheet.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText(testObjectName)).toBeVisible({
      timeout: 15000,
    })
  })

  test('edit object metadata', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Find and open the test object
    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await expect(page.getByText(testObjectName)).toBeVisible()

    // Go to metadata tab and edit
    await page.getByRole('tab', { name: 'Metadata' }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    const updatedName = `${testObjectName} Updated`
    await page.getByLabel('Name').fill(updatedName)
    await page.getByLabel('Abbreviation').fill('EET')
    await page.getByLabel('Version').fill('2.0')
    await page.getByLabel('Description').fill('Updated by E2E tests')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(updatedName)).toBeVisible({
      timeout: 10000,
    })

    // Update the test object name for subsequent tests
    testObjectName = updatedName
  })

  test('edit object properties', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    // Go to properties tab
    await page.getByRole('tab', { name: 'Properties' }).click()
    await expect(page.getByText('initial.property')).toBeVisible()

    // Edit properties
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByText('initial.property').first().click()

    // Update property name and value
    await page.getByLabel('Property Name').first().fill('updated.property')
    await page
      .getByPlaceholder('Enter property value')
      .first()
      .fill('updated value')

    // Add another value
    await page.getByRole('button', { name: 'Add Value' }).click()
    await page
      .getByPlaceholder('Enter property value')
      .nth(1)
      .fill('second value')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('updated.property')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('updated value')).toBeVisible()
  })

  test('add address to existing object', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    // Go to metadata tab and edit address
    await page.getByRole('tab', { name: 'Metadata' }).click()

    // Scroll down to address section
    await page.getByText('Address').scrollIntoViewIfNeeded()
    await page
      .getByRole('button', { name: 'Edit' })
      .filter({ hasText: 'Address' })
      .or(page.getByRole('button', { name: 'Edit' }).nth(1))
      .click()

    const addressInput = page.getByPlaceholder('Search for building address...')
    await addressInput.fill('London')

    const addressSuggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(addressSuggestion).toBeVisible({ timeout: 10000 })
    await addressSuggestion.click()

    await page.getByRole('button', { name: 'Save' }).click()

    // Verify address is saved
    await expect(page.locator('text=London')).toBeVisible({ timeout: 10000 })
  })

  test('add parent relationship to existing object', async ({ page }) => {
    // First create a parent object
    const parentName = `E2E Parent for ${testObjectName}`
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create object/i }).click()

    const addSheet = getDialogByTitle(page, 'Add Object')
    await expect(addSheet).toBeVisible()

    await addSheet.getByLabel('Name').fill(parentName)
    await addSheet.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 15000 })

    // Now add parent relationship to test object
    const row = page
      .locator('tbody tr')
      .filter({ hasText: testObjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.dblclick()

    await page.getByRole('tab', { name: 'Relationships' }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await page
      .getByRole('button', { name: /search for parent objects/i })
      .click()
    await page.getByPlaceholder('Search parent objects...').fill(parentName)
    await page.getByText(parentName).first().click()

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(parentName)).toBeVisible({
      timeout: 10000,
    })
  })
})
