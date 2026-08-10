import { expect, test } from '../fixtures/app'

test.describe('00 - harness / build', () => {
  test('the server under test exposes test ids', async ({ page }) => {
    await page.goto('/objects')

    await expect(
      page.locator('[data-testid], [data-tour]').first(),
      'No test hooks in the DOM. If this is a production build, rebuild with ' +
        'E2E_KEEP_TEST_IDS=true — see internal-docs/11-e2e-test-plan.md §4.9.'
    ).toBeAttached()
  })
})
