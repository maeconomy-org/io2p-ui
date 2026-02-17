import { test, expect } from '@playwright/test'

/**
 * Models Page Smoke Test
 *
 * Verifies:
 * - Page loads correctly
 * - "Add Model" sheet opens
 * - Table/List is visible
 */

test.describe('08 - Models Smoke', () => {
  test('TC001: Models page loads and interactions work', async ({ page }) => {
    await page.goto('/models')

    // Check title
    await expect(
      page.getByRole('heading', { level: 2, name: /models/i })
    ).toBeVisible()

    // Check Add Model button
    const addButton = page.getByRole('button', { name: /add model/i })
    await expect(addButton).toBeVisible()

    // Open Add Model Sheet
    await addButton.click()
    await expect(
      page.getByRole('dialog').filter({ hasText: /create new model/i })
    ).toBeVisible()

    // Close Sheet
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Check table presence (assuming table headers exist)
    // Note: If empty, it might show "No Templates Found", which is also a valid state
    const tableOrEmpty = page
      .locator('table')
      .or(page.getByText(/no templates found/i))
    await expect(tableOrEmpty).toBeVisible()
  })
})
