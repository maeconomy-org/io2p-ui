import { test, expect } from '@playwright/test'

import {
  createObjectWithProperty,
  openObject,
  goToPropertiesTab,
} from '../utils/test-helpers'

/**
 * Object Properties
 *
 * Tests property display modes (detailed/grid), property interactions,
 * and view toggling in the properties tab.
 */

const runId = Date.now()

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
    await goToPropertiesTab(page)

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
    await expect(
      page.locator('[data-testid^="property-header-"]').first()
    ).toBeVisible({ timeout: 5000 })

    // Switch to grid view
    await gridToggle.click()
    await page.waitForTimeout(300)

    // In grid view, property-header-0 should not be visible (grid uses different layout)
    await expect(
      page.locator('[data-testid^="property-header-"]').first()
    ).not.toBeVisible({ timeout: 3000 })

    // Verify property name and value are visible in grid view
    await expect(page.getByText('Material', { exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByText('Concrete')).toBeVisible({ timeout: 3000 })

    // Switch back to detailed view
    await detailedToggle.click()
    await page.waitForTimeout(300)

    // Verify property header is visible again
    await expect(
      page.locator('[data-testid^="property-header-"]').first()
    ).toBeVisible({ timeout: 5000 })

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
    await goToPropertiesTab(page)

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
    await goToPropertiesTab(page)

    // Property header should be visible
    const propertyHeader = page
      .locator('[data-testid^="property-header-"]')
      .first()
    await expect(propertyHeader).toBeVisible({ timeout: 5000 })

    // Value detail section should not be visible initially (collapsed)
    // Note: the header shows a truncated preview, so we check the detail container
    await expect(
      page.locator('[data-testid^="property-value-"]').first()
    ).not.toBeVisible({ timeout: 3000 })

    // Click to expand
    await propertyHeader.click()
    await page.waitForTimeout(300)

    // Verify value detail container is visible in expanded content
    await expect(
      page.locator('[data-testid^="property-value-"]').first()
    ).toBeVisible({ timeout: 5000 })

    // Click again to collapse
    await propertyHeader.click()
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid^="property-value-"]').first()
    ).not.toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Close' }).first().click()
  })
})
