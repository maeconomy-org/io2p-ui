import { expect, test } from '../fixtures/app'
import { selectView } from '../utils/views'
import { OBJECT_LIST } from './search'

/**
 * The column view's error and retry. Not `.read.`: the view is an account preference, so this
 * writes it, and puts the table back in `afterAll` whatever the test did.
 */

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/objects')
  await selectView(page, 'table')
  await page.close()
})

test.describe('17 - search / list errors in the column view', () => {
  test('SE8: two server faults show the error in the column, and Try again loads it', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/status of 500/)
    await page.goto('/objects')
    await selectView(page, 'columns')

    let failing = true
    await page.route(OBJECT_LIST, (route) =>
      failing
        ? route.fulfill({
            status: 500,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              type: 'about:blank',
              title: 'Error',
              status: 500,
              detail: 'boom',
            }),
          })
        : route.continue()
    )
    await page.reload()

    const error = page.getByTestId('list-error')
    await expect(error).toBeVisible()
    failing = false
    await error.getByRole('button').click()
    await expect(page.getByTestId('column-row').first()).toBeVisible()
    await expect(error).toHaveCount(0)
  })
})
