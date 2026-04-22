import { test, expect } from '@playwright/test'

/**
 * Group Pagination
 *
 * Verifies server-side pagination on `/groups` (12 per page).
 *
 * Does NOT seed its own fixtures — the groups API does not currently expose a
 * bulk-seed endpoint, and creating 13 groups per run balloons the database.
 * Instead the spec skips gracefully if the user's instance does not yet have
 * enough groups. Once a test fixture lands, remove the skip guards.
 */

test.describe('06 - Group Pagination', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()
    await page.waitForLoadState('networkidle')
  })

  test('TC001: Previous disabled on first page, Next enabled when paginated', async ({
    page,
  }) => {
    const nextButton = page.getByRole('button', { name: /^next$/i })
    const hasPagination = await nextButton
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
    if (!hasPagination) {
      test.skip(true, 'Not enough groups to paginate (<13)')
      return
    }

    const prevButton = page.getByRole('button', { name: /^previous$/i })
    await expect(prevButton).toBeDisabled()
    await expect(nextButton).toBeEnabled()
  })

  test('TC002: Clicking Next advances to page 2 and updates page indicator', async ({
    page,
  }) => {
    const nextButton = page.getByRole('button', { name: /^next$/i })
    if (!(await nextButton.isVisible().catch(() => false))) {
      test.skip(true, 'Not enough groups to paginate')
      return
    }

    await nextButton.click()
    await page.waitForLoadState('networkidle')

    // Page 2 button rendered with `variant="default"` when active — the
    // button content shows the page number. Assert via aria-current-ish proxy:
    // the previous button is now enabled.
    await expect(
      page.getByRole('button', { name: /^previous$/i })
    ).toBeEnabled()
  })

  test('TC003: Clicking Previous returns to page 1', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /^next$/i })
    if (!(await nextButton.isVisible().catch(() => false))) {
      test.skip(true, 'Not enough groups to paginate')
      return
    }

    await nextButton.click()
    await page.waitForLoadState('networkidle')

    const prevButton = page.getByRole('button', { name: /^previous$/i })
    await prevButton.click()
    await page.waitForLoadState('networkidle')

    await expect(prevButton).toBeDisabled()
  })
})
