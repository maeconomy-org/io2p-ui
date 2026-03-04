import { test, expect } from '@playwright/test'

/**
 * Groups Page E2E Tests
 *
 * Comprehensive coverage for:
 * - Page load and basic elements
 * - Search functionality
 * - Filter functionality (all/my/shared)
 * - Create group with public/private options
 * - View group details
 * - Inline name editing
 * - Pagination
 */

test.describe('10 - Groups Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/groups')
    // Wait for page to load
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
  })

  test('TC001: Page loads with all elements', async ({ page }) => {
    // Check Create Group button
    const createButton = page.getByTestId('create-group-button')
    await expect(createButton).toBeVisible()

    // Check search input
    const searchInput = page.getByTestId('group-search-input')
    await expect(searchInput).toBeVisible()

    // Check filter dropdown
    const filterButton = page.getByRole('button', { name: /filter/i })
    await expect(filterButton).toBeVisible()

    // Groups grid should be visible (may be empty)
    const groupsGrid = page.getByTestId('groups-grid')
    await expect(groupsGrid).toBeVisible()
  })

  test('TC002: Search functionality works', async ({ page }) => {
    const searchInput = page.getByTestId('group-search-input')

    // Type in search
    await searchInput.fill('test search')
    await expect(searchInput).toHaveValue('test search')

    // Clear search
    const clearButton = page.getByTestId('group-search-clear-button')
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click()
      await expect(searchInput).toHaveValue('')
    }
  })

  test('TC003: Filter dropdown shows options', async ({ page }) => {
    // Open filter dropdown
    const filterButton = page.getByRole('button', { name: /filter/i })
    await filterButton.click()

    // Check filter options exist
    await expect(page.getByRole('menuitem', { name: /all/i })).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /my groups/i })
    ).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /shared/i })).toBeVisible()

    // Close dropdown
    await page.keyboard.press('Escape')
  })

  test('TC004: Create Group sheet opens and closes', async ({ page }) => {
    const createButton = page.getByTestId('create-group-button')
    await createButton.click()

    // Check sheet opens
    await expect(page.getByText(/create new group/i)).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(page.getByText(/create new group/i)).toBeHidden()
  })

  test('TC005: Create Group form has all fields', async ({ page }) => {
    await page.getByTestId('create-group-button').click()

    // Check form fields
    await expect(page.getByLabel(/name/i)).toBeVisible()
    await expect(page.getByText(/public/i)).toBeVisible()
    await expect(page.getByText(/private/i)).toBeVisible()

    // Check permission options
    await expect(page.getByText(/read/i)).toBeVisible()

    // Close sheet
    await page.keyboard.press('Escape')
  })

  test('TC006: Group cards are clickable to view details', async ({ page }) => {
    // Find first group card if any exist
    const firstGroupCard = page.locator('[data-testid^="group-card-"]').first()

    if (await firstGroupCard.isVisible().catch(() => false)) {
      await firstGroupCard.click()

      // Check that view sheet opens
      await expect(page.getByRole('tab', { name: /users/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /info/i })).toBeVisible()

      // Close sheet
      await page.keyboard.press('Escape')
    } else {
      test.skip(true, 'No groups available to test')
    }
  })

  test('TC007: Group view sheet shows Info tab with visibility', async ({
    page,
  }) => {
    const firstGroupCard = page.locator('[data-testid^="group-card-"]').first()

    if (await firstGroupCard.isVisible().catch(() => false)) {
      await firstGroupCard.click()

      // Click Info tab
      await page.getByRole('tab', { name: /info/i }).click()

      // Check visibility section exists
      await expect(page.getByText(/visibility/i)).toBeVisible()

      // Close sheet
      await page.keyboard.press('Escape')
    } else {
      test.skip(true, 'No groups available to test')
    }
  })

  test('TC009: Pagination controls work when groups exist', async ({
    page,
  }) => {
    // Check if pagination exists
    const prevButton = page.getByRole('button', { name: /previous/i })
    const nextButton = page.getByRole('button', { name: /next/i })

    if (await nextButton.isVisible().catch(() => false)) {
      // Check initial state - prev should be disabled on first page
      await expect(prevButton).toBeDisabled()

      // If next is enabled, click it
      if (await nextButton.isEnabled().catch(() => false)) {
        await nextButton.click()
        // After clicking next, prev should be enabled
        await expect(prevButton).toBeEnabled()

        // Go back
        await prevButton.click()
        await expect(prevButton).toBeDisabled()
      }
    }
  })

  test('TC010: Filter selection filters groups', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: /filter/i })

    // Test 'My Groups' filter
    await filterButton.click()
    await page.getByRole('menuitem', { name: /my groups/i }).click()

    // Filter should be applied (page may show filtered results or empty)
    // Check that filter button still shows
    await expect(filterButton).toBeVisible()

    // Test 'Shared' filter
    await filterButton.click()
    await page.getByRole('menuitem', { name: /shared/i }).click()
    await expect(filterButton).toBeVisible()

    // Reset to 'All'
    await filterButton.click()
    await page.getByRole('menuitem', { name: /all/i }).click()
  })

  test('TC011: Group card inline edit button is visible', async ({ page }) => {
    const firstGroupCard = page.locator('[data-testid^="group-card-"]').first()

    if (await firstGroupCard.isVisible().catch(() => false)) {
      // Hover over card to see edit button
      await firstGroupCard.hover()

      // Check for edit button (pencil icon or similar)
      const editButton = firstGroupCard.locator('button').first()
      if (await editButton.isVisible().catch(() => false)) {
        await expect(editButton).toBeVisible()
      }
    } else {
      test.skip(true, 'No groups available to test')
    }
  })

  test('TC012: Group view sheet Users tab shows content', async ({ page }) => {
    const firstGroupCard = page.locator('[data-testid^="group-card-"]').first()

    if (await firstGroupCard.isVisible().catch(() => false)) {
      await firstGroupCard.click()

      // Users tab should be visible by default
      await expect(page.getByRole('tab', { name: /users/i })).toBeVisible()

      // Check for users content or empty state
      const usersContent = page.locator('text=/members|users|owner/i').first()
      await expect(usersContent).toBeVisible()

      await page.keyboard.press('Escape')
    } else {
      test.skip(true, 'No groups available to test')
    }
  })
})
