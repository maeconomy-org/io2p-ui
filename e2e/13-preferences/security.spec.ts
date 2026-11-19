import type { Browser, Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { securityCredentials } from '../setup/credentials'
import { resetPreferences } from '../utils/preferences'
import { restoreSession, signedOutContext, signInAs } from '../utils/session'
import { totp } from '../utils/totp'

/**
 * Settings > Security on a throwaway account: change the password, turn two-factor on and off,
 * and sign out other sessions. `afterAll` puts the account back (first password, two-factor off)
 * through the auth API, reading at each step what the issuer answers, so a run that failed half way
 * is repaired too. It then restores the primary session, as every spec that signs in elsewhere does.
 */

const who = securityCredentials()
// Derived, so no password is written in this file.
const changedPassword = `${who?.password ?? ''}-e2e`
let password = who?.password ?? ''
let secret: string | null = null

async function authCall(
  page: Page,
  path: string,
  body: unknown
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  return page.evaluate(
    async ({ path, body }) => {
      const config = (
        window as unknown as { __IOM_CONFIG__?: { authBaseUrl?: string } }
      ).__IOM_CONFIG__
      const res = await fetch(`${config?.authBaseUrl}/api/auth${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: res.status, json: await res.json().catch(() => null) }
    },
    { path, body }
  )
}

async function restoreAccount(browser: Browser) {
  const original = who!.password
  const context = await signedOutContext(browser)
  const page = await context.newPage()
  await page.goto('/')
  let current = original
  let signIn = await authCall(page, '/sign-in/email', {
    email: who!.email,
    password: original,
  })
  if (signIn.status !== 200) {
    current = changedPassword
    signIn = await authCall(page, '/sign-in/email', {
      email: who!.email,
      password: current,
    })
  }
  expect(signIn.status, 'neither password signs the account in').toBe(200)
  if (signIn.json?.twoFactorRedirect) {
    expect(secret, 'two-factor is on but its secret was lost').not.toBeNull()
    await authCall(page, '/two-factor/verify-totp', { code: totp(secret!) })
  }
  // Answers an error when two-factor is already off, which is the state wanted.
  await authCall(page, '/two-factor/disable', { password: current })
  if (current !== original) {
    const changed = await authCall(page, '/change-password', {
      currentPassword: current,
      newPassword: original,
    })
    expect(changed.status).toBe(200)
  }
  await context.close()
}

async function signedInPage(browser: Browser): Promise<Page> {
  const context = await signedOutContext(browser)
  const page = await context.newPage()
  await page.goto('/')
  await signInAs(page, { email: who!.email, password })
  return page
}

async function openSecurity(page: Page) {
  await page.goto('/settings')
  await page.getByTestId('settings-tab-security').click()
}

test.describe('13 - preferences / security', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(
    !who,
    'set E2E_EMAIL_3 and E2E_PASSWORD_3 in .env.local to a spare seeded account'
  )

  // A fresh account would open its first-login tour over Settings and take the clicks.
  test.beforeAll(async ({ browser }) => {
    const page = await signedInPage(browser)
    await resetPreferences(page)
    await page.context().close()
  })

  test.afterAll(async ({ browser }) => {
    test.setTimeout(120_000)
    await restoreAccount(browser)
    const context = await signedOutContext(browser)
    await restoreSession(await context.newPage())
    await context.close()
  })

  test('SEC1: a changed password signs in, and the old one no longer does', async ({
    browser,
  }) => {
    const page = await signedInPage(browser)
    await openSecurity(page)
    await page.locator('input[autocomplete="current-password"]').fill(password)
    await page
      .locator('input[autocomplete="new-password"]')
      .fill(changedPassword)
    const changed = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/change-password')
    )
    await page.getByTestId('change-password-submit').click()
    expect((await changed).ok()).toBe(true)
    const previous = password
    password = changedPassword

    const fresh = await (await signedOutContext(browser)).newPage()
    await fresh.goto('/')
    await fresh.getByLabel('Email').fill(who!.email)
    await fresh.getByLabel('Password').fill(previous)
    await fresh.getByTestId('auth-email-submit').click()
    await expect(fresh.getByTestId('auth-error')).toBeVisible()
    await expect(fresh).toHaveURL(/\/$/)

    await signInAs(fresh, { email: who!.email, password })
    await expect(fresh).toHaveURL(/\/objects$/)
  })

  test('SEC2: two-factor turns on with an authenticator code, is asked at sign-in, and turns off', async ({
    browser,
  }) => {
    const page = await signedInPage(browser)
    await openSecurity(page)
    await page.getByTestId('tfa-enable').click()
    await page.locator('#tfa-pw').fill(password)
    await page.getByTestId('tfa-continue').click()
    secret = (await page.getByTestId('tfa-secret').innerText()).trim()
    await page.locator('#tfa-code').fill(totp(secret))
    await page.getByTestId('tfa-verify').click()
    await expect(page.getByTestId('tfa-enabled')).toBeVisible()

    const fresh = await (await signedOutContext(browser)).newPage()
    await fresh.goto('/')
    await fresh.getByLabel('Email').fill(who!.email)
    await fresh.getByLabel('Password').fill(password)
    await fresh.getByTestId('auth-email-submit').click()
    await expect(fresh).toHaveURL(/\/two-factor$/)
    await fresh.getByRole('textbox').first().fill(totp(secret))
    await fresh.getByTestId('two-factor-verify').click()
    await expect(fresh).toHaveURL(/\/objects$/)

    await page.getByTestId('tfa-disable').click()
    await page.locator('#tfa-pw-disable').fill(password)
    await page.getByTestId('tfa-disable-confirm').click()
    await expect(page.getByTestId('tfa-enable')).toBeVisible()
    secret = null
  })

  test('SEC3: signing out other sessions ends them', async ({ browser }) => {
    const other = await signedInPage(browser)
    const page = await signedInPage(browser)
    await openSecurity(page)
    await expect(
      page.locator('[data-testid="session-row"]:not([data-current])').first()
    ).toBeVisible()

    await page.getByTestId('sessions-revoke-others').click()
    await expect(page.getByTestId('session-row')).toHaveCount(1)

    await other.goto('/objects')
    await expect(other).toHaveURL(/\/$/)
  })
})
