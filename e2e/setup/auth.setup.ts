import { expect, type Page, test as setup } from '@playwright/test'

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

  await expect(page.locator('.driver-popover')).toHaveCount(0)

  // Views and locale are ACCOUNT preferences, so they outlive the run: a spec that leaves
  // /processes in the Sankey view breaks every table spec in the next one. Any page that gains a
  // view preference belongs in this loop.
  for (const path of ['/objects', '/processes']) {
    await page.goto(path)
    await normaliseToTableView(page)
  }

  await page.goto('/settings')
  await page.getByTestId('settings-tab-appearance').click()
  await expect(async () => {
    await page.getByTestId('appearance-language-en').click()
    await expect(page.getByTestId('appearance-language-en')).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })

  await page.context().storageState({ path: AUTH_STATE })
})

async function normaliseToTableView(page: Page) {
  // `toPass`: a click landing before hydration does nothing at all, silently.
  await expect(async () => {
    await page.getByTestId('view-option-table').click()
    await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })

  // The click renders from local state while the PATCH is still in flight; closing the context
  // aborts it. Only surviving a reload proves the write landed.
  await page.reload()
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 30_000 })
}
