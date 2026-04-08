import { test, expect } from '@playwright/test'

/**
 * Groups Smoke Tests
 *
 * Coverage for:
 * - Page load and basic elements
 * - Search functionality
 * - Filter dropdown options
 * - Create group sheet open/close
 * - Create group form fields
 * - Pagination
 */

test.describe('01 - Groups Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
  })

  test('TC001: Page loads with all elements', async ({ page }) => {
    const createButton = page.getByTestId('create-group-button')
    await expect(createButton).toBeVisible()

    const searchInput = page.getByTestId('group-search-input')
    await expect(searchInput).toBeVisible()

    const filterButton = page.getByRole('button', { name: /filter/i })
    await expect(filterButton).toBeVisible()
  })

  test('TC002: Search functionality works', async ({ page }) => {
    const searchInput = page.getByTestId('group-search-input')

    await searchInput.fill('test search')
    await expect(searchInput).toHaveValue('test search')

    const clearButton = page.getByTestId('group-search-clear-button')
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click()
      await expect(searchInput).toHaveValue('')
    }
  })

  test('TC003: Filter dropdown shows options', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: /filter/i })
    await filterButton.click()

    await expect(
      page.locator('[cmdk-item]').filter({ hasText: /all/i })
    ).toBeVisible()
    await expect(
      page.locator('[cmdk-item]').filter({ hasText: /my groups/i })
    ).toBeVisible()
    await expect(
      page.locator('[cmdk-item]').filter({ hasText: /shared/i })
    ).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('TC004: Create Group sheet opens and closes', async ({ page }) => {
    await page.getByTestId('create-group-button').click()
    await expect(page.getByText(/create new group/i)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText(/create new group/i)).toBeHidden()
  })

  test('TC005: Create Group form has all fields', async ({ page }) => {
    await page.getByTestId('create-group-button').click()

    const sheet = page.getByLabel(/create new group/i)
    await expect(sheet).toBeVisible()

    await expect(sheet.getByLabel(/name/i)).toBeVisible()
    await expect(sheet.getByText(/public/i)).toBeVisible()
    await expect(sheet.getByText(/private/i)).toBeVisible()
    await expect(sheet.getByText(/read/i)).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('TC006: Pagination controls work when groups exist', async ({
    page,
  }) => {
    // Wait for group data to load before checking pagination
    await expect(
      page.locator('[data-testid^="group-card-"]').first()
    ).toBeVisible({ timeout: 10000 })

    const nextButton = page.getByRole('button', { name: /^next$/i })
    const prevButton = page.getByRole('button', { name: /^previous$/i })

    // Pagination should be visible when there are more than 12 groups
    await expect(nextButton).toBeVisible({ timeout: 5000 })
    await expect(prevButton).toBeDisabled()

    await nextButton.click()
    await expect(prevButton).toBeEnabled()

    await prevButton.click()
    await expect(prevButton).toBeDisabled()
  })
})
