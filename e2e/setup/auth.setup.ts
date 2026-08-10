import { expect, type Page, test as setup } from '@playwright/test'

import { AUTH_STATE, requireCredentials } from './credentials'

/**
 * Signs in once and saves the browser state every other project reuses.
 *
 * Email/password rather than the client certificate: mTLS terminates at nginx on the deployed node
 * and has no local equivalent, so the certificate path is covered by `14-auth/certificate.spec.ts`
 * under a condition-skip. See internal-docs/11-e2e-test-plan.md §4.8.
 *
 * The predecessor cached this itself — 180 lines that re-read the file, base64-decoded the JWT and
 * compared `exp` against a 5-minute buffer. `storageState` is already a cache, and a bespoke token
 * parser fails open: four of its branches were `if (await x.isVisible())`, which is false for a
 * hidden element and skips without saying so.
 */
setup('authenticate', async ({ page }) => {
  const { email, password } = requireCredentials()

  await page.goto('/')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in with Email' }).click()

  await page.waitForURL('**/objects')
  // `.first()` — the columns view adds an "All objects" column heading, so an unscoped match is
  // ambiguous depending on which view the account was last left in.
  await expect(
    page.getByRole('heading', { name: /objects/i }).first()
  ).toBeVisible()

  // Onboarding is STATE, not a flow to click past — and that state lives on the ACCOUNT now, so
  // this cannot seed it from the browser. Assert instead: the shared login has finished the
  // welcome tour, and if it ever has not, every downstream spec is about to click through an
  // overlay and this line says so first.
  await expect(page.locator('.driver-popover')).toHaveCount(0)

  // EVERY page that stores a view preference, not just the first one.
  //
  // These live PER ACCOUNT on the node, not in this browser, so they outlive the run. A spec that
  // leaves `/objects` in the columns view means the next run's table specs find no table — that
  // took out four parallel specs at once, because they share this login. Adding `/processes` here
  // is the same lesson learned twice: it was left in the Sankey view and every list spec failed.
  //
  // A suite has to start from a state it chose. Any page that gains a view preference belongs in
  // this list on the same day.
  for (const path of ['/objects', '/processes']) {
    await page.goto(path)
    await normaliseToTableView(page)
  }

  await page.context().storageState({ path: AUTH_STATE })
})

/**
 * Puts the current page in its table view and proves the choice was stored.
 *
 * `toPass`, not a click followed by an assertion: the button can be clicked before hydration
 * attaches its handler, in which case nothing happens at all. Retrying the whole click-and-check
 * absorbs that instead of guessing at a timeout. Clicking a view that is already correct is a
 * no-op.
 */
async function normaliseToTableView(page: Page) {
  await expect(async () => {
    await page.getByTestId('view-option-table').click()
    await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })

  // Reload and re-check: the click renders the table immediately from local state, but the write
  // is a PATCH to the node that can still be in flight when this context closes — which aborts it
  // and leaves the account on whatever it was. Surviving a reload is the only proof it landed.
  await page.reload()
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 30_000 })
}
