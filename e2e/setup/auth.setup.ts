import { expect, test as setup } from '@playwright/test'

import { resetPreferences } from '../utils/preferences'
import { ensureRootObjects } from '../utils/seed-objects'
import { AUTH_STATE, requireCredentials } from './credentials'

/** Signs in once and saves the state every other project reuses. See §4.8 of the e2e plan. */
setup('authenticate', async ({ page }) => {
  const { email, password } = requireCredentials()

  await page.goto('/')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in with Email' }).click()

  await page.waitForURL('**/objects')
  // The columns view adds a second "All objects" heading.
  await expect(
    page.getByRole('heading', { name: /objects/i }).first()
  ).toBeVisible()

  await resetPreferences(page)
  // Setup already owns the account's preconditions, and this is one: half the suite opens on a
  // `data-table-row`, and L1/L2 need MORE THAN ONE PAGE of them. Writes nothing when the account
  // already has enough.
  await ensureRootObjects(page)

  // The reset lands on the node; the tab still holds the old values in its `/me` cache.
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 30_000 })

  // AFTER the reset, not before: a tour left armed here blocks the first click on every list page
  // with `driver-overlay`, and the click reports a 60s timeout rather than naming the overlay.
  await expect(page.locator('.driver-popover')).toHaveCount(0)

  await page.context().storageState({ path: AUTH_STATE })
})
