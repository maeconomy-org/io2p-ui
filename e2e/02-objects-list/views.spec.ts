import { expect, test } from '../fixtures/app'

/**
 * §6.3 L20 — the view selector, which is a PREFERENCE and therefore a write.
 *
 * Not `.read.`, even though switching a view creates nothing: the choice is stored per account on
 * the node, so running this in parallel changes what every other worker sees. It has to be serial,
 * and it has to put the table back.
 */

test.describe('02 - objects list / views', () => {
  test.afterEach(async ({ page }) => {
    // Restore, or every spec after this one starts in the columns view.
    await page.goto('/objects')
    await page.getByTestId('view-option-table').click()
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('L20/PR3: the columns view replaces the table and the choice persists', async ({
    page,
  }) => {
    await page.goto('/objects')
    // The first-load skeleton rows are `aria-hidden` and carry no testid, so the TABLE is visible
    // before any real row is. Counting on container visibility alone reads 0 and looks like an
    // empty list.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    const tableRows = await page.getByTestId('data-table-row').count()
    expect(tableRows).toBeGreaterThan(0)

    await page.getByTestId('view-option-columns').click()
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    // The preference half: a reload must come back in the same view. Held only in component state
    // it would silently revert, and the setting on /settings would appear to do nothing.
    await page.reload()
    await expect(page.getByTestId('data-table')).toHaveCount(0)
    await expect(page.getByTestId('view-option-columns')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
