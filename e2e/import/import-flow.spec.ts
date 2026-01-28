import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import')
    await page.waitForLoadState('networkidle')
  })

  test('should display import page', async ({ page }) => {
    // Verify the import page loads without errors
    const errorElement = page.locator('text=Application error')
    await expect(errorElement).not.toBeVisible()

    // Page should have some content
    const mainContent = page.locator('main, [role="main"], .container').first()
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })

  test('should show error for invalid file type', async ({ page }) => {
    // Create a test file with invalid extension
    const fileInput = page.locator('input[type="file"]')

    if (await fileInput.isVisible()) {
      // Create a buffer for a fake txt file
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('invalid content'),
      })

      // Should show error message about file type
      await expect(page.locator('text=/xlsx|csv|file type/i')).toBeVisible({
        timeout: 5000,
      })
    }
  })

  test('should accept CSV file and show preview', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')

    if (await fileInput.isVisible()) {
      // Create a valid CSV file
      const csvContent =
        'name,description,version\nTest Object,A test object,1.0\nAnother Object,Another test,2.0'

      await fileInput.setInputFiles({
        name: 'test-import.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      })

      // Should show preview or mapping step
      await expect(
        page.locator('text=/preview|mapping|column|next/i').first()
      ).toBeVisible({ timeout: 10000 })
    }
  })

  test('should show column mapping interface after file upload', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"]')

    if (await fileInput.isVisible()) {
      const csvContent =
        'name,description,version\nTest Object,A test object,1.0'

      await fileInput.setInputFiles({
        name: 'mapping-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      })

      // Wait for mapping interface
      await page.waitForTimeout(2000)

      // Should show column headers from CSV
      const nameColumn = page.locator('text=/name/i').first()
      await expect(nameColumn).toBeVisible({ timeout: 10000 })
    }
  })
})
