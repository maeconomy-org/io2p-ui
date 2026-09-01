import { expect, test } from '../fixtures/app'

test.describe('00 - harness / build', () => {
  test('the server under test exposes test ids', async ({ page }) => {
    await page.goto('/objects')

    await expect(
      page.locator('[data-testid], [data-tour]').first(),
      'No test hooks in the DOM. If this is a production build, rebuild with ' +
        'E2E_KEEP_TEST_IDS=true — see docs/e2e-docs/e2e-test-plan.md §4.9.'
    ).toBeAttached()
  })

  // `reuseExistingServer` takes whatever holds :3000, and a dev server keeps its test ids, so the
  // flag check above passes against one. Four cases assert on deployment limits the dev server
  // serves defaults for, and the React Compiler only runs in a production build — which is the
  // only place bugs #2, #3 and #7 were visible.
  test('the server under test is a production build', async ({ page }) => {
    const devChunks: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('hmr-client') || url.includes('next-devtools')) {
        devChunks.push(url)
      }
    })

    await page.goto('/objects')

    expect(
      devChunks,
      'This is a `next dev` server. Stop it and run the suite against ' +
        '`pnpm run build:e2e && pnpm run start:e2e`.'
    ).toEqual([])
  })
})
