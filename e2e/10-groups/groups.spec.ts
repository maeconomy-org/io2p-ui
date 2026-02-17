import { test, expect } from '@playwright/test'

/**
 * Groups Page Smoke Test
 *
 * Verifies:
 * - Page loads correctly
 * - "Create Group" sheet opens
 * - Stats cards are visible
 */

test.describe('10 - Groups Smoke', () => {
  test('TC001: Groups page loads and interactions work', async ({ page }) => {
    await page.goto('/groups')

    // Check title
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    // Check Create Group button
    const createButton = page.getByRole('button', { name: /create group/i })
    await expect(createButton).toBeVisible()

    // Check Stats
    await expect(page.getByText(/total groups/i)).toBeVisible()
    await expect(page.getByText(/public groups/i)).toBeVisible()

    // Open Create Group Sheet
    await createButton.click()
    await expect(page.getByText(/create new group/i)).toBeVisible()

    // Close Sheet (assuming clicking outside given specific close button might not be labeled "Cancel" in all sheets)
    // Actually looking at code, it uses GroupCreateEditSheet. We can press Escape or click outside.
    await page.keyboard.press('Escape')
    await expect(page.getByText(/create new group/i)).toBeHidden()

    // Search interaction
    const searchButton = page.locator('[data-testid="group-search-toggle"]')
    if ((await searchButton.count()) > 0) {
      await searchButton.click()
      await expect(page.getByPlaceholder(/search groups/i)).toBeVisible()
    }
  })
})
