import { test as setup, expect } from '@playwright/test'

/**
 * Authentication setup for E2E tests
 * This runs before all tests to ensure the app is accessible
 *
 * Note: This app uses certificate-based auth, so we're mainly checking
 * that the app loads and the auth context initializes properly
 */
setup('verify app loads', async ({ page }) => {
  // Navigate to the app
  await page.goto('/')

  // Wait for the app to load (check for main layout elements)
  await expect(page.locator('body')).toBeVisible()

  // The app should redirect or show content based on auth state
  // We're just verifying the app boots without errors
  await page.waitForLoadState('networkidle')
})
