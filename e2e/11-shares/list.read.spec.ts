import { expect, test } from '../fixtures/app'

/**
 * §6.13 S1, S2, S10 — the two tabs and what belongs on each.
 *
 * `.read.` — none of these create a share.
 */

test.describe('11 - shares / list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shares')
    await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
  })

  test('S1: two tabs, one kind of thing in each', async ({ page }) => {
    await expect(page.getByTestId('shares-tab-shares')).toBeVisible()
    await expect(page.getByTestId('shares-tab-direct')).toBeVisible()

    // A count, not two presence checks: a third tab would satisfy both of those and still be a
    // regression against the split this page exists to make.
    await expect(page.locator('[data-testid^="shares-tab-"]')).toHaveCount(2)
  })

  test('S2: filters render on the Shares tab only', async ({ page }) => {
    await expect(page.getByTestId('filter-menu')).toBeVisible()

    // `/access/shared-by-me` takes no filters at all, so a filter control on the direct tab would
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

    // ⚠ The request is the assertion. Names come off each grant row; fetching a page of users to
    // resolve them looked identical on screen and cost a request per render. Nothing on screen can
    // tell the two apart, which is why this is asserted on the wire.
    await expect(page.getByTestId('shares-tab-direct')).toHaveAttribute(
      'data-state',
      'active'
    )
    expect(api.count(/\/users\?.*size=/)).toBe(0)
  })
})
