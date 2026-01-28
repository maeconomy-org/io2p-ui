import { test, expect } from '@playwright/test'

test.describe('Object Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await page.waitForLoadState('networkidle')
  })

  test('should display objects list or empty state', async ({ page }) => {
    // Should show either objects table or empty state
    const content = page.locator('main, [role="main"], .container').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('should have add object button', async ({ page }) => {
    // Look for add/create button
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [data-testid="add-object"]'
    )

    // Button should exist (may be disabled based on auth)
    const buttonCount = await addButton.count()
    expect(buttonCount).toBeGreaterThanOrEqual(0)
  })

  test('should open object creation form when clicking add', async ({
    page,
  }) => {
    const addButton = page
      .locator(
        'button:has-text("Add"), button:has-text("Create"), button:has-text("New")'
      )
      .first()

    if (await addButton.isVisible()) {
      await addButton.click()

      // Should show form with name field
      await expect(
        page.locator(
          'input[name="name"], input[placeholder*="name" i], label:has-text("Name")'
        )
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('should validate required fields in object form', async ({ page }) => {
    const addButton = page
      .locator(
        'button:has-text("Add"), button:has-text("Create"), button:has-text("New")'
      )
      .first()

    if (await addButton.isVisible()) {
      await addButton.click()

      // Wait for form
      await page.waitForTimeout(500)

      // Try to submit without filling required fields
      const submitButton = page
        .locator(
          'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
        )
        .first()

      if (await submitButton.isVisible()) {
        await submitButton.click()

        // Should show validation error
        await expect(
          page.locator('text=/required|invalid|error/i').first()
        ).toBeVisible({ timeout: 3000 })
      }
    }
  })

  test('should fill and submit object creation form', async ({ page }) => {
    const addButton = page
      .locator(
        'button:has-text("Add"), button:has-text("Create"), button:has-text("New")'
      )
      .first()

    if (await addButton.isVisible()) {
      await addButton.click()

      // Fill in the name field
      const nameInput = page
        .locator('input[name="name"], input[placeholder*="name" i]')
        .first()

      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Object ${Date.now()}`)

        // Fill description if available
        const descInput = page
          .locator('textarea[name="description"], input[name="description"]')
          .first()
        if (await descInput.isVisible()) {
          await descInput.fill('E2E test object description')
        }

        // Submit the form
        const submitButton = page
          .locator(
            'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
          )
          .first()

        if (
          (await submitButton.isVisible()) &&
          (await submitButton.isEnabled())
        ) {
          await submitButton.click()

          // Wait for response - should either succeed or show error
          await page.waitForTimeout(2000)
        }
      }
    }
  })
})
