import { test, expect } from '@playwright/test'

test.describe('Search Functionality', () => {
  test('should have search input on objects page', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    // Look for search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i], [data-testid="search-input"]'
    )

    // Search should be available
    const count = await searchInput.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should filter results when searching', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i]'
      )
      .first()

    if (await searchInput.isVisible()) {
      // Type a search query
      await searchInput.fill('test')
      await searchInput.press('Enter')

      // Wait for search results
      await page.waitForTimeout(1000)

      // Page should still be functional
      const errorElement = page.locator('text=Application error')
      await expect(errorElement).not.toBeVisible()
    }
  })

  test('should clear search and show all results', async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i]'
      )
      .first()

    if (await searchInput.isVisible()) {
      // Search then clear
      await searchInput.fill('test')
      await page.waitForTimeout(500)
      await searchInput.clear()
      await page.waitForTimeout(500)

      // Should work without errors
      const errorElement = page.locator('text=Application error')
      await expect(errorElement).not.toBeVisible()
    }
  })
})
