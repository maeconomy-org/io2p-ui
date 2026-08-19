import { expect, test, type Page } from '@playwright/test'

import { requireCredentials, type Credentials } from '../setup/credentials'

/**
 * io2p-auth keeps ONE live session per origin, so signing in as a second account ENDS the first
 * account's session server-side — for every browser context, not just the one that signed in.
 * `browser.newContext()` isolates cookies, not the session record on the node.
 *
 * That is correct product behaviour and reproduces by hand: sign in as A, sign in as B in the same
 * browser, and A is logged out. It means a spec that switches accounts is DESTRUCTIVE to the shared
 * session every other write spec is relying on, and `storageState` cannot save them — the token it
 * holds is already dead.
 *
 * So a spec that signs in as anyone else owes a `restoreSession` afterwards.
 */
export async function signInAs(page: Page, who: Credentials): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(who.password)
  await page.getByTestId('auth-email-submit').click()
  await page.waitForURL(/\/(objects|two-factor)$/)

  // An account with TOTP on cannot be driven without its secret. Named rather than left to time out
  // sixty seconds later against a page the test never expected to be on.
  test.skip(
    page.url().includes('/two-factor'),
    `${who.email} has two-factor enabled — turn it off for the e2e account, or the grantee cannot sign in`
  )
}

/**
 * Put the PRIMARY account back, for a spec that signed in as someone else.
 *
 * Belongs in an `afterAll`, not an `afterEach`: the damage is done once per switch, and the specs
 * that follow are in other files entirely.
 */
export async function restoreSession(page: Page): Promise<void> {
  await signInAs(page, requireCredentials())
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
}
