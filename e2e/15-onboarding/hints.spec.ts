import { expect, test } from '../fixtures/app'

/**
 * The unread dot on a page's help button.
 *
 * These specs share one account across runs, so they never assert a STARTING
 * state — only the invariants that hold whatever the account has already read:
 * opening clears the dot, a reload keeps it cleared, and a second open writes
 * nothing.
 */

test.describe.configure({ mode: 'serial' })

const help = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /what is an object/i })

test.describe('15 - onboarding / concept hints', () => {
  test('opening the hint clears the dot for good', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await help(page).hover()
    await expect(page.getByTestId('concept-hint-unread')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('concept-hint-unread')).toHaveCount(0)
  })

  test('a hint already read writes nothing when opened again', async ({
    page,
    api,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    // Settle the first-visit write, if this account had not read it yet.
    await help(page).hover()
    await expect(page.getByTestId('concept-hint-unread')).toHaveCount(0)

    api.clear()
    await help(page).hover()
    await help(page).blur()
    await help(page).hover()

    await api.expectCount(/\/v1\/me\/preferences/, 0)
  })
})

test.describe('15 - onboarding / tours stay repeatable', () => {
  /**
   * The rule this pins: a help tour records NOTHING, so nothing can ever hide
   * it. Only the welcome tour is remembered, because only it starts by itself.
   */
  test('the same tour can be started twice', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    for (const attempt of [1, 2]) {
      await help(page).hover()
      await page.getByRole('button', { name: /tour/i }).click()
      await expect(page.locator('.driver-popover')).toBeVisible({
        timeout: 15_000,
      })

      await page.locator('.driver-popover-close-btn').click()
      await expect(page.locator('.driver-popover')).toHaveCount(0)
      expect(attempt).toBeLessThanOrEqual(2)
    }
  })
})
