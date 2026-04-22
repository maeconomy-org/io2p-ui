import { test, expect } from '@playwright/test'

/**
 * Error Boundary + Not Found Coverage
 *
 * Verifies:
 * - Navigating to an unknown route renders `not-found.tsx`
 * - Not-found page offers a "Go Home" link that returns to `/`
 *
 * Note: `error.tsx` requires a runtime error to trigger. There is no
 * test-only error route in the app, so we don't exercise it here — add a
 * dedicated `/api/__throw` or `/__error-test` route first if the error
 * boundary needs direct e2e coverage.
 */

test.describe('11 - Error Boundaries', () => {
  test('TC001: Unknown route renders not-found page', async ({ page }) => {
    await page.goto('/this-route-should-never-exist-xyz')

    await expect(page.getByText(/page not found/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(/does not exist or has been moved/i)
    ).toBeVisible()
  })

  test('TC002: "Go Home" from not-found returns to landing route', async ({
    page,
  }) => {
    await page.goto('/another-nonexistent-path')
    await expect(page.getByText(/page not found/i)).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('link', { name: /go home/i }).click()
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/another-nonexistent-path/)
  })
})
