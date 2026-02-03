import { test, expect, type Page } from '@playwright/test'

/**
 * Object CRUD Operations - Core Flows
 *
 * Tests basic Create, Read, Update, Delete operations.
 * Uses unique names with timestamps so cleanup is not required.
 */

const runId = Date.now()

// Helpers
const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

const createObject = async (page: Page, name: string, description?: string) => {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })

  await sheet.getByLabel('Name').fill(name)
  if (description) {
    await sheet.getByLabel('Description').fill(description)
  }

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
}

const openObject = async (page: Page, name: string) => {
  // Refresh page to ensure latest data
  await page.reload()
  await page.waitForLoadState('networkidle')

  let row = page.locator('tbody tr').filter({ hasText: name }).first()

  // If not visible on first page, try searching
  if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Use search to find the object
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
  await row.dblclick()
  await page.waitForTimeout(500)
}

test.describe('01 - Object CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('TC001: Create object with name only', async ({ page }) => {
    const name = `TC001 Object ${runId}`

    await createObject(page, name)

    // Verify in list
    await expect(page.getByText(name).first()).toBeVisible()
  })

  test('TC002: Create object with full metadata', async ({ page }) => {
    const name = `TC002 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByLabel('Abbreviation').fill('TC2')
    await sheet.getByLabel('Version').fill('1.0.0')
    await sheet.getByLabel('Description').fill('Full metadata test object')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify metadata saved
    await openObject(page, name)
    await page.getByRole('tab', { name: /metadata/i }).click()

    await expect(page.getByText('TC2').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('1.0.0').first()).toBeVisible()
    await expect(
      page.getByText('Full metadata test object').first()
    ).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC003: Create object with address', async ({ page }) => {
    const name = `TC003 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    // Add address via autocomplete
    const addressInput = sheet.getByPlaceholder(
      'Search for building address...'
    )
    await addressInput.fill('Berlin')

    const suggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(suggestion).toBeVisible({ timeout: 10000 })
    await suggestion.click()

    // Verify address components appear
    await expect(sheet.locator('text=🏘️')).toBeVisible({ timeout: 3000 })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify address saved
    await openObject(page, name)
    await page.getByRole('tab', { name: /metadata/i }).click()
    await expect(page.getByText('Berlin').first()).toBeVisible({
      timeout: 5000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC004: Create object with properties', async ({ page }) => {
    const name = `TC004 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    // Add property with multiple values
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Material Type')
    await sheet.getByPlaceholder('Enter property value').first().fill('Steel')

    await sheet.getByRole('button', { name: 'Add Another Value' }).click()
    await sheet.getByPlaceholder('Enter property value').nth(1).fill('Recycled')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify properties saved
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()

    await expect(page.getByText('Material Type').first()).toBeVisible({
      timeout: 5000,
    })
    // Click to expand property
    await page.getByText('Material Type').first().click()
    await expect(page.getByText('Steel').first()).toBeVisible()
    await expect(page.getByText('Recycled').first()).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC005: Create object with parent relationship', async ({ page }) => {
    const parentName = `TC005 Parent ${runId}`
    const childName = `TC005 Child ${runId}`

    // Create parent
    await createObject(page, parentName, 'Parent object')

    // Create child with parent
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(childName)

    // Open parent selector popover - click the combobox trigger
    await sheet.locator('text=Search for parent objects...').click()
    // Wait for popover and search results to load
    await page.waitForTimeout(1000)
    await page.getByPlaceholder('Search parent objects...').fill(parentName)
    await page.waitForTimeout(1000)
    // Select from the command list
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: parentName })
      .first()
      .click()

    await expect(sheet.getByText('1 parent selected')).toBeVisible({
      timeout: 3000,
    })

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify relationship
    await openObject(page, childName)
    await page.getByRole('tab', { name: /relationships/i }).click()
    await expect(page.getByText(parentName).first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC006: Create object with file attachment', async ({ page }) => {
    const name = `TC006 Object ${runId}`

    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)

    // Add file
    await sheet.getByRole('button', { name: /attach file/i }).click()
    const attachModal = getDialog(page, 'Object Attachments')
    await expect(attachModal).toBeVisible({ timeout: 5000 })

    await attachModal.locator('input[type="file"]').setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF test content'),
    })

    await attachModal.getByRole('button', { name: 'Done' }).click()

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify file attached
    await openObject(page, name)
    await page.getByRole('tab', { name: /files/i }).click()
    await expect(page.getByText('test-document.pdf').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC007: Edit object metadata', async ({ page }) => {
    const name = `TC007 Object ${runId}`
    const updatedName = `TC007 Updated ${runId}`

    await createObject(page, name, 'Original description')

    // Open and edit
    await openObject(page, name)
    await page.getByRole('tab', { name: /metadata/i }).click()

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByLabel('Name').fill(updatedName)
    await page.getByLabel('Description').fill('Updated description')
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify update
    await expect(page.getByText(updatedName).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText('Updated description').first()).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC008: Verify object properties persist', async ({ page }) => {
    const name = `TC008 Object ${runId}`

    // Create with property
    await page.getByRole('button', { name: /create object/i }).click()
    const sheet = getDialog(page, 'Add Object')
    await expect(sheet).toBeVisible()

    await sheet.getByLabel('Name').fill(name)
    await sheet.getByRole('button', { name: 'Add Property' }).click()
    await sheet.getByLabel('Property Name').fill('Building Height')
    await sheet
      .getByPlaceholder('Enter property value')
      .first()
      .fill('120 meters')

    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(sheet).toBeHidden({ timeout: 15000 })

    // Verify property persists after reopening
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()

    // Click to expand and verify property exists with correct value
    await page.getByText('Building Height').first().click()
    await expect(page.getByText('120 meters').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC009: Add property to existing object', async ({ page }) => {
    const name = `TC009 Object ${runId}`

    await createObject(page, name)

    // Open and add property
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()

    await page.getByRole('button', { name: 'Edit' }).first().click()
    // Button text varies: "Add Property" or "Add Your First Property"
    await page
      .getByRole('button', { name: /add.*property/i })
      .first()
      .click()
    await page.getByLabel('Property Name').last().fill('Floor Count')
    await page.getByPlaceholder('Enter property value').last().fill('25 floors')
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify - click to expand
    await page.getByText('Floor Count').first().click()
    await expect(page.getByText('25 floors').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC010: Add address to existing object', async ({ page }) => {
    const name = `TC010 Object ${runId}`

    await createObject(page, name)

    // Open and add address
    await openObject(page, name)
    await page.getByRole('tab', { name: /metadata/i }).click()

    // Find address section edit button (sibling of Address heading)
    await page
      .getByRole('heading', { name: 'Address' })
      .scrollIntoViewIfNeeded()
    await page
      .getByRole('heading', { name: 'Address' })
      .locator('..')
      .getByRole('button', { name: 'Edit' })
      .click()

    const addressInput = page.getByPlaceholder('Search for building address...')
    await addressInput.fill('Munich')

    const suggestion = page
      .locator('div.absolute.z-50 div.cursor-pointer')
      .first()
    await expect(suggestion).toBeVisible({ timeout: 10000 })
    await suggestion.click()

    await page.getByRole('button', { name: 'Save' }).click()

    // Verify
    await expect(page.getByText('Munich').first()).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
