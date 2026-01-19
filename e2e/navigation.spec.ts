import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*/)
  })

  test('should navigate to objects page', async ({ page }) => {
    await page.goto('/objects')

    // Should show objects page or redirect based on auth
    await page.waitForLoadState('networkidle')

    // Check that the page loaded without errors
    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('should navigate to models page', async ({ page }) => {
    await page.goto('/models')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('should navigate to import page', async ({ page }) => {
    await page.goto('/import')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('should navigate to processes page', async ({ page }) => {
    await page.goto('/processes')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('should navigate to groups page', async ({ page }) => {
    await page.goto('/groups')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })
})
