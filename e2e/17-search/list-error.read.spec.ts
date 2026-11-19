import { expect, test } from '../fixtures/app'
import { OBJECT_LIST, openSearch, qOf } from './search'

/**
 * A list that cannot load says why, and a refused search never reads as "no results". Every
 * failure is crafted with `page.route`, so nothing is written and the spec is `.read.`.
 */

const problem = (status: number, detail: string) => ({
  status,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Error', status, detail }),
})

test.describe('17 - search / list errors', () => {
  test('SE1: two server faults show the error, and Try again loads the rows', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/status of 500/)
    let calls = 0
    await page.route(OBJECT_LIST, (route) => {
      calls += 1
      // A 5xx is retried once on its own, so the first load is two calls.
      return calls <= 2 ? route.fulfill(problem(500, 'boom')) : route.continue()
    })

    await page.goto('/objects')
    const error = page.getByTestId('list-error')
    await expect(error).toBeVisible()
    expect(calls).toBe(2)

    await error.getByRole('button').click()
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('SE2: a picker the node refuses says why, never "No objects found"', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/status of 422/)
    const detail = 'refused for the e2e test'
    await page.route(OBJECT_LIST, (route) =>
      qOf(route.request().url()) === 'zzrefused'
        ? route.fulfill(problem(422, detail))
        : route.continue()
    )

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openSearch(page)
    await page.getByTestId('add-filter').click()
    const panel = page.getByTestId('filter-panel')
    await panel.locator('[aria-labelledby$="-folder-label"]').click()
    await page.getByTestId('object-picker-search').fill('zzrefused')

    const refusal = page.getByTestId('picker-list-error')
    await expect(refusal).toContainText(detail)
    // cmdk's empty row is the "No objects found" text.
    await expect(page.locator('[cmdk-empty]')).toHaveCount(0)
  })
})
