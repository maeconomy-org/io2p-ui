import { expect, test } from '../fixtures/app'

test.describe('11 - shares / list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shares')
    await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
  })

  test('S1: two tabs, one kind of thing in each', async ({ page }) => {
    await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
    await expect(page.getByTestId('shares-tab-direct')).toBeVisible()

    await expect(page.locator('[data-testid^="shares-tab-"]')).toHaveCount(2)
  })

  test('S2: filters render on the Shares tab only', async ({ page }) => {
    await expect(page.getByTestId('filter-menu')).toBeVisible()

    // be a control that runs and does nothing — the exact class this suite is built around.
    await page.getByTestId('shares-tab-direct').click()
    await expect(page.getByTestId('filter-menu')).toHaveCount(0)
  })

  test('S10: opening the direct tab fetches no page of users', async ({
    page,
    api,
  }) => {
    api.clear()
    await page.getByTestId('shares-tab-direct').click()

    await expect(page.getByTestId('shares-tab-direct')).toHaveAttribute(
      'data-state',
      'active'
    )
    expect(api.count(/\/users\?.*size=/)).toBe(0)
  })
})
