import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * The harness testing itself.
 *
 * `consoleGuard` and `api` fail tests from outside the test body, and `tour()` resolves anchors
 * through an import from `src/` — none of which is exercised by simply existing. A fixture that has
 * never fired is indistinguishable from one that is wired up wrong.
 */
test.describe('00 - harness', () => {
  test('the typed tour() layer resolves anchors the app really renders', async ({
    page,
  }) => {
    await page.goto('/objects')

    // These come from `TOUR_ANCHORS` in src/, so a rename there fails `typecheck:e2e` rather than
    // silently matching nothing here — the whole point of the layer.
    await expect(tour(page, 'topNav')).toBeVisible()
    await expect(tour(page, 'navObjects')).toBeVisible()
    await expect(tour(page, 'searchButton')).toBeVisible()
    await expect(tour(page, 'createObject')).toBeVisible()
  })

  test('the api recorder sees the requests the page actually made', async ({
    page,
    api,
  }) => {
    await page.goto('/objects')
    await expect(tour(page, 'createObject')).toBeVisible()

    // Asserting on the REQUEST is what catches a control that runs and sends the wrong thing —
    // the `5df2f1c` template regression passed every other gate in the repo.
    expect(api.count(/\/objects/)).toBeGreaterThan(0)
    expect(api.matching(/\/objects/)[0]?.path).toContain('/objects')
  })
})
