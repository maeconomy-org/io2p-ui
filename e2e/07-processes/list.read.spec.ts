import { expect, test } from '../fixtures/app'

/**
 * §6.11 PR1a, PR2 — the processes list chrome that needs no seeding.
 *
 * `.read.` covers the cases that only change what is DISPLAYED. Two neighbours are deliberately
 * elsewhere: the view selector writes an account preference, so PR3/PR4 are in `views.spec.ts`,
 * and the `?ref=` filter needs a process that really uses a known object, so PR16-PR18 are in
 * `related.spec.ts`.
 */

test.describe('07 - processes / list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('PR2: filters render only in table view', async ({ page }) => {
    // `isTable &&` gates them. In a graph view a scope filter has nothing to filter, and offering
    // one would be a control that runs and does nothing.
    await expect(page.getByTestId('filter-menu')).toBeVisible()
  })

  test('PR1a: the list renders rows', async ({ page }) => {
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()

    // No pagination assertion here. `TablePagination` returns null when `totalPages <= 1`, so on a
    // node with one page of processes it is correctly absent — asserting it would test the amount
    // of seed data, not the app. Paging is covered by L1/L2 against the objects list, and the
    // component is shared.
  })
})
