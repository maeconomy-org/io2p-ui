import { expect, test } from '../fixtures/app'

/** §6.3 L20 — the view selector is an account preference, so this writes and must be serial. */

test.describe('02 - objects list / views', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/objects')
    await page.getByTestId('view-option-table').click()
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('L20/PR3: the columns view replaces the table and the choice persists', async ({
    page,
  }) => {
    await page.goto('/objects')
    // Skeleton rows are `aria-hidden` with no testid, so the table is visible before any real row.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    const tableRows = await page.getByTestId('data-table-row').count()
    expect(tableRows).toBeGreaterThan(0)

    await page.getByTestId('view-option-columns').click()
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    // Held only in component state it would revert on reload.
    await page.reload()
    await expect(page.getByTestId('data-table')).toHaveCount(0)
    await expect(page.getByTestId('view-option-columns')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
