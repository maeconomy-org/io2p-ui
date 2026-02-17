import { test, expect, type Page } from '@playwright/test'

/**
 * Object Properties
 *
 * Tests property display modes (detailed/grid), property interactions,
 * and view toggling in the properties tab.
 */

const runId = Date.now()

const getDialog = (page: Page, title: string) =>
  page.getByRole('dialog').filter({ hasText: title })

const createObjectWithProperty = async (
  page: Page,
  name: string,
  propName: string,
  propValue: string
) => {
  await page.getByRole('button', { name: /create object/i }).click()
  const sheet = getDialog(page, 'Add Object')
  await expect(sheet).toBeVisible({ timeout: 5000 })

  await sheet.getByLabel('Name').fill(name)
  await sheet.getByRole('button', { name: 'Add Property' }).click()
  await sheet.getByLabel('Property Name').fill(propName)
  await sheet.getByPlaceholder('Enter property value').first().fill(propValue)

  await sheet.getByRole('button', { name: 'Create' }).click()
  await expect(sheet).toBeHidden({ timeout: 15000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
}

const openObject = async (page: Page, name: string) => {
  await page.reload()
  await page.waitForLoadState('networkidle')

  let row = page.locator('tbody tr').filter({ hasText: name }).first()

  if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) {
    await page.reload()
    await page.waitForLoadState('networkidle')
    row = page.locator('tbody tr').filter({ hasText: name }).first()
  }

  await expect(row).toBeVisible({ timeout: 15000 })
  await row.locator('[data-testid="object-details-button"]').click()
  await page.waitForTimeout(1000)

  const detailsSheet = page.getByRole('dialog').first()
  await expect(detailsSheet).toBeVisible({ timeout: 10000 })
}

test.describe('09 - Object Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 })
  })

  test('TC029: Toggle between detailed and grid view', async ({ page }) => {
    const name = `TC029 Object ${runId}`

    // Create object with a property
    await createObjectWithProperty(page, name, 'Material', 'Concrete')

    // Open object details
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.waitForTimeout(500)

    // Verify detailed view toggle is visible and active by default
    const detailedToggle = page.locator(
      '[data-testid="properties-detailed-view-toggle"]'
    )
    const gridToggle = page.locator(
      '[data-testid="properties-grid-view-toggle"]'
    )
    await expect(detailedToggle).toBeVisible({ timeout: 5000 })
    await expect(gridToggle).toBeVisible({ timeout: 5000 })

    // Verify property header is visible in detailed view
    await expect(page.locator('[data-testid="property-header-0"]')).toBeVisible(
      { timeout: 5000 }
    )

    // Switch to grid view
    await gridToggle.click()
    await page.waitForTimeout(300)

    // In grid view, property-header-0 should not be visible (grid uses different layout)
    await expect(
      page.locator('[data-testid="property-header-0"]')
    ).not.toBeVisible({ timeout: 3000 })

    // Verify property name and value are visible in grid view
    await expect(page.getByText('Material')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Concrete')).toBeVisible({ timeout: 3000 })

    // Switch back to detailed view
    await detailedToggle.click()
    await page.waitForTimeout(300)

    // Verify property header is visible again
    await expect(page.locator('[data-testid="property-header-0"]')).toBeVisible(
      { timeout: 5000 }
    )

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC030: Grid view displays multiple properties correctly', async ({
    page,
  }) => {
    const name = `TC030 Object ${runId}`

    // Create object with property
    await createObjectWithProperty(page, name, 'Weight', '150kg')

    // Open object details
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.waitForTimeout(500)

    // Switch to grid view
    const gridToggle = page.locator(
      '[data-testid="properties-grid-view-toggle"]'
    )
    await expect(gridToggle).toBeVisible({ timeout: 5000 })
    await gridToggle.click()
    await page.waitForTimeout(300)

    // Verify property is displayed in grid format
    await expect(page.getByText('Weight')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('150kg')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })

  test('TC031: Expand and collapse property in detailed view', async ({
    page,
  }) => {
    const name = `TC031 Object ${runId}`

    // Create object with property
    await createObjectWithProperty(page, name, 'Density', '2400 kg/m³')

    // Open object details
    await openObject(page, name)
    await page.getByRole('tab', { name: /properties/i }).click()
    await page.waitForTimeout(500)

    // Property header should be visible
    const propertyHeader = page.locator('[data-testid="property-header-0"]')
    await expect(propertyHeader).toBeVisible({ timeout: 5000 })

    // Expanded content should not be visible initially
    await expect(
      page.locator('[data-testid="property-expanded-0"]')
    ).not.toBeVisible({ timeout: 3000 })

    // Click to expand
    await propertyHeader.click()
    await expect(
      page.locator('[data-testid="property-expanded-0"]')
    ).toBeVisible({ timeout: 5000 })

    // Verify value is visible in expanded content
    await expect(
      page.locator('[data-testid="property-0-value-0"]')
    ).toBeVisible({ timeout: 5000 })

    // Click again to collapse
    await propertyHeader.click()
    await expect(
      page.locator('[data-testid="property-expanded-0"]')
    ).not.toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
