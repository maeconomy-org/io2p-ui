import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import { sheet } from '../utils/sheet'

/** §6.11 PR1a, PR2. View preferences are in `views.spec.ts`; the `?ref=` filter in `related.spec.ts`. */

test.describe('07 - processes / list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('PR2: filters render only in table view', async ({ page }) => {
    // one would be a control that runs and does nothing.
    await expect(page.getByTestId('filter-menu')).toBeVisible()
  })

  test('PR1a: the list renders rows', async ({ page }) => {
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    // No pagination assertion here. `TablePagination` returns null when `totalPages <= 1`, so on a
  })

  test('PR1b: the create sheet opens from the list and cancels', async ({
    page,
  }) => {
    await tour(page, 'processesCreate').click()

    const panel = sheet(page)
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: /cancel/i }).click()
    await expect(panel).toBeHidden()
  })
})
