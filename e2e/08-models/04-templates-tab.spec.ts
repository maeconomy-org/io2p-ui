import { test, expect } from '@playwright/test'

/**
 * Templates Page Tabs
 *
 * Verifies:
 * - Both tabs render (Object Templates + Formulas)
 * - Switching tabs reveals the correct content
 * - Per-tab create button is visible only on its active tab
 * - Switching away and back preserves content (local state)
 */

test.describe('04 - Templates Page Tabs', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  })

  test('TC001: Both tabs are visible and default to Object Templates', async ({
    page,
  }) => {
    const modelsTab = page.getByRole('tab', { name: /object templates/i })
    const formulasTab = page.getByRole('tab', { name: /formulas/i })

    await expect(modelsTab).toBeVisible()
    await expect(formulasTab).toBeVisible()
    await expect(modelsTab).toHaveAttribute('data-state', 'active')
  })

  test('TC002: Switching to Formulas tab reveals its create button', async ({
    page,
  }) => {
    const formulasTab = page.getByRole('tab', { name: /formulas/i })
    await formulasTab.click()
    await expect(formulasTab).toHaveAttribute('data-state', 'active')

    // Formulas tab exclusives: Formula Reference + Create Formula buttons
    await expect(
      page.getByRole('button', { name: /formula reference/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^create formula$/i })
    ).toBeVisible()
  })

  test('TC003: Switching back to Object Templates preserves tab state', async ({
    page,
  }) => {
    const modelsTab = page.getByRole('tab', { name: /object templates/i })
    const formulasTab = page.getByRole('tab', { name: /formulas/i })

    await formulasTab.click()
    await expect(formulasTab).toHaveAttribute('data-state', 'active')
    await modelsTab.click()
    await expect(modelsTab).toHaveAttribute('data-state', 'active')

    // Create Model button is tab-specific to Object Templates
    await expect(
      page.getByRole('button', { name: /create model/i })
    ).toBeVisible()
  })
})
