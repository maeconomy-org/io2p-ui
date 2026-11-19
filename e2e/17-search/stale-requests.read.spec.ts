import { expect, test } from '../fixtures/app'
import { OBJECT_LIST, qOf, runSearch } from '../utils/search'

/**
 * An answer to an older search never replaces the newer one. The first answer is held on a
 * promise, not a timer, and released only after the second search has rendered.
 */

const STALE_NAME = 'e2e-stale-answer-row'

test.describe('17 - search / stale answers', () => {
  test('SE3: an answer that arrives after a newer search is never shown', async ({
    page,
  }) => {
    let arrived: () => void = () => {}
    const firstArrived = new Promise<void>((resolve) => (arrived = resolve))
    let release: () => void = () => {}
    const released = new Promise<void>((resolve) => (release = resolve))
    let handled: () => void = () => {}
    const staleHandled = new Promise<void>((resolve) => (handled = resolve))

    await page.route(OBJECT_LIST, async (route) => {
      if (qOf(route.request().url()) !== 'aaold') return route.continue()
      arrived()
      await released
      // A real answer with one row renamed, so the row is one the UI would draw.
      const unfiltered = new URL(route.request().url())
      unfiltered.searchParams.delete('q')
      const real = await (await route.fetch({ url: unfiltered.href })).json()
      const [first] = real.data
      // The newer search may have cancelled this request: then the answer is dropped, which is
      // just as right, so a failed fulfill is not an error.
      await route
        .fulfill({
          json: {
            ...real,
            data: [{ ...first, name: STALE_NAME }],
            page: { ...real.page, totalElements: 1, totalPages: 1 },
          },
        })
        .catch(() => {})
      handled()
    })

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await runSearch(page, 'aaold')
    await firstArrived

    const second = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === 'bbnew'
    )
    await runSearch(page, 'bbnew')
    await second
    await expect(page.getByTestId('data-table')).toBeVisible()

    release()
    await staleHandled
    // Two frames: React has committed whatever that answer would render.
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done))
        )
    )

    await expect(page.getByText(STALE_NAME)).toHaveCount(0)
  })
})
