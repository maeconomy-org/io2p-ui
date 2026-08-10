import { expect, test as setup } from '@playwright/test'

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

  // Onboarding is STATE, not a flow to click past. Seeding the key keeps the tour overlay off the
  // first click of every downstream spec; `15-onboarding` clears it and drives the tours
  // deliberately, which is the only place they should run.
  await page.evaluate(() =>
    localStorage.setItem('onboarding:initial-login:v1', 'done')
  )

  // Normalise the list view.
  //
  // View preferences are stored PER ACCOUNT on the node, not in this browser — so they outlive the
  // run, and one spec leaving the account in the columns view means the next run's table specs
  // find no table. That is not hypothetical: it happened, and it took out four parallel specs at
  // once because they share this login. A suite has to start from a state it chose.
  await page.getByTestId('view-option-table').click()

  // A generous timeout ONLY here. The list renders behind `viewResolved`, which follows the `/me`
  // request that carries the account's preferences — and this is the cold path: a token minted
  // seconds ago, nothing cached, retries in play. Warm, the table paints in under a second; on
  // this first load it has taken over ten. Every other spec inherits a warm context and the
  // default 10s, so raising it globally would only hide slowness that matters.
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 60_000 })

  // Reload and re-check: the click renders the table immediately from local state, but the write
  // is a PATCH to the node that can still be in flight when this context closes — which aborts it
  // and leaves the account on whatever it was. Surviving a reload is the only proof it landed.
  await page.reload()
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 30_000 })

  await page.context().storageState({ path: AUTH_STATE })
})
