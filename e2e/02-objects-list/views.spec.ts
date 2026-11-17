import { expect, test } from '../fixtures/app'
import { serveObjectList } from '../utils/capped-list'

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

  test('L37: a capped column reads 1,000+ and pages past its reported count', async ({
    page,
    api,
  }) => {
    const list = await serveObjectList(page, () => ({ rows: 'full' }))
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await page.getByTestId('view-option-columns').click()
    await expect(page.getByTestId('data-table')).toHaveCount(0)

    await expect(page.getByTestId('column-item-count').first()).toContainText(
      /1[.,]000/
    )
    await expect(page.getByTestId('column-page-of').first()).toHaveText(
      new RegExp(`${list.cappedPages()}\\+$`)
    )

    // The reported count is a lower limit, so a page after it is accepted, not clamped.
    const past = list.cappedPages() + 1
    const input = page.getByTestId('column-page-input').first()
    await input.fill(String(past))
    await input.press('Enter')
    await expect
      .poll(() => api.count(new RegExp(`/v1/objects\\?.*page=${past}(&|$)`)))
      .toBeGreaterThan(0)
    await expect(input).toHaveValue(String(past))
  })
})
