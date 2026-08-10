import { expect, test } from '../fixtures/app'

/**
 * Fails fast when the server under test cannot support the suite.
 *
 * `next.config.mjs` strips `data-testid` from production builds, so running against a plain
 * `next start` makes EVERY locator resolve to nothing — which looks exactly like a broken page,
 * two hundred times over, each after its own 60-second timeout. One assertion up front turns a
 * confusing hour into a one-line diagnosis.
 */
test.describe('00 - harness / build', () => {
  test('the server under test exposes test ids', async ({ page }) => {
    await page.goto('/objects')

    // The navbar is on every authenticated page and carries no conditional rendering, so its
    // absence means the attributes were stripped rather than that this page is unusual.
    await expect(
      page.locator('[data-testid], [data-tour]').first(),
      'No test hooks in the DOM. If this is a production build, rebuild with ' +
        'E2E_KEEP_TEST_IDS=true — see internal-docs/11-e2e-test-plan.md §4.9.'
    ).toBeAttached()
  })
})
