import { expect, test, type Page } from '@playwright/test'

import {
  AUTH_STATE,
  requireCredentials,
  type Credentials,
} from '../setup/credentials'

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
  // Callers arrive here right after clicking sign-out, which fires its OWN redirect to `/`. A
  // `goto` racing that redirect is cancelled by the browser as `net::ERR_ABORTED`, so let the
  // redirect land on its own first and navigate only if it never comes.
  const form = page.getByTestId('auth-email-submit')
  try {
    await form.waitFor({ state: 'visible', timeout: 5_000 })
  } catch {
    await page.goto('/')
    await expect(form).toBeVisible()
  }

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
 *
 * Rewrites `AUTH_STATE`, which is the half that matters. Signing back in repairs the live page, but
 * every following test builds its context from the file on disk — and that still holds the token
 * the sign-out invalidated, so they all start signed out with a 401 no assertion explains.
 */
export async function restoreSession(page: Page): Promise<void> {
  await signInAs(page, requireCredentials())
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await page.context().storageState({ path: AUTH_STATE })
}
