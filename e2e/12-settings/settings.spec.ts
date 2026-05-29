import { test, expect } from '@playwright/test'

/**
 * Settings page E2E
 *
 * Covers the /settings route: it loads, the three tabs switch, the user-menu
 * link reaches it, and a view preference set here survives a reload (proving
 * the account-scoped localStorage persistence end-to-end).
 */
test.describe('12 - Settings', () => {
  test.describe.configure({ mode: 'serial' })

  test('TC: settings page loads with the three tabs', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByTestId('settings-tab-account')).toBeVisible()
    await expect(page.getByTestId('settings-tab-appearance')).toBeVisible()
    await expect(page.getByTestId('settings-tab-preferences')).toBeVisible()

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('TC: tabs switch between Account, Appearance and Preferences', async ({
    page,
  }) => {
    await page.goto('/settings')

    await page.getByTestId('settings-tab-appearance').click()
    await expect(page.getByText('Theme', { exact: true })).toBeVisible()

    await page.getByTestId('settings-tab-preferences').click()
    await expect(page.getByTestId('pref-objects')).toBeVisible()
    await expect(page.getByTestId('pref-processes')).toBeVisible()
    await expect(page.getByTestId('pref-properties')).toBeVisible()
  })

  test('TC: a view preference set here persists across a reload', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()

    await page.getByTestId('pref-properties-grid').click()
    await expect(page.getByTestId('pref-properties-grid')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await page.reload()
    await page.getByTestId('settings-tab-preferences').click()
    await expect(page.getByTestId('pref-properties-grid')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('TC: the user menu links to settings', async ({ page }) => {
    await page.goto('/objects')

    await page.locator('[data-tour="user-menu-trigger"]').click()
    await page.getByTestId('nav-settings').click()

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByTestId('settings-page')).toBeVisible()
  })
})
