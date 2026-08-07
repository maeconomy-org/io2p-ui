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
  await expect(page.getByRole('heading', { name: /objects/i })).toBeVisible()

  // Onboarding is STATE, not a flow to click past. Seeding the key keeps the tour overlay off the
  // first click of every downstream spec; `15-onboarding` clears it and drives the tours
  // deliberately, which is the only place they should run.
  await page.evaluate(() =>
    localStorage.setItem('onboarding:initial-login:v1', 'done')
  )

  await page.context().storageState({ path: AUTH_STATE })
})
