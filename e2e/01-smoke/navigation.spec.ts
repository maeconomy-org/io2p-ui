import { test, expect } from '@playwright/test'

test.describe('00 - Navigation Smoke Tests', () => {
  test('TC001: Load home page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*/)
  })

  test('TC002: Navigate to objects page', async ({ page }) => {
    await page.goto('/objects')

    // Should show objects page or redirect based on auth
    await page.waitForLoadState('networkidle')

    // Check that the page loaded without errors
    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('TC003: Navigate to models page', async ({ page }) => {
    await page.goto('/models')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('TC004: Navigate to import page', async ({ page }) => {
    await page.goto('/import')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('TC005: Navigate to processes page', async ({ page }) => {
    await page.goto('/processes')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })

  test('TC006: Navigate to groups page', async ({ page }) => {
    await page.goto('/groups')
    await page.waitForLoadState('networkidle')

    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()
  })
})
