import type { Browser } from '@playwright/test'

import { AUTH_STATE } from '../setup/credentials'

/**
 * The account's stored preferences, read from an ALREADY-AUTHENTICATED context.
 *
 * The signed-out cases in `14-auth/pre-login-chrome.read.spec.ts` assert that a theme or language
 * click writes NOTHING to the account. They used to assert that no REQUEST matched
 * `/me/preferences`, and this reads the stored bag instead — a stronger assertion, because it tests
 * the outcome rather than the mechanism that carries it. Inverted: a preference written mid-case
 * fails those cases, where the request form stayed green.
 *
 * ⚠ CORRECTION, 2026-09-04. An earlier version of this comment said the `api` fixture cannot see a
 * preference PATCH at all. That was wrong, and it was wrong the same way SH1's header was: the
 * probe behind it clicked the control BEFORE hydration and without a `toPass` retry, so no write
 * ever happened — and "no request recorded" got read as "no request recordable". Re-measured with a
 * hydration-safe click, both `page.on('request')` and the fixture record
 * `PATCH /api/v1/me/preferences` exactly as the SDK issues it. The fixture is fine. Nothing else in
 * this suite should be built on the claim that it is not.
 *
 * A SEPARATE context carrying `AUTH_STATE`, never a sign-in on the page under test: io2p-auth keeps
 * one live session per origin, so signing in from the signed-out page would end the session every
 * other spec is running on — trading a weak assertion for a suite-wide cascade.
 */
export async function accountPreferences(
  browser: Browser
): Promise<Record<string, unknown>> {
  const context = await browser.newContext({ storageState: AUTH_STATE })
  const page = await context.newPage()
  try {
    await page.goto('/objects')
    return await page.evaluate(async () => {
      const config = (
        window as unknown as {
          __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
        }
      ).__IOM_CONFIG__
      if (!config?.authBaseUrl || !config?.coreBaseUrl) {
        throw new Error('runtime config missing authBaseUrl/coreBaseUrl')
      }
      const minted = await fetch(`${config.authBaseUrl}/api/auth/token`, {
        credentials: 'include',
      })
      if (!minted.ok) throw new Error(`token mint failed: ${minted.status}`)
      const { token } = (await minted.json()) as { token?: string }

      const me = await fetch(`${config.coreBaseUrl}/api/v1/me`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!me.ok) throw new Error(`me failed: ${me.status}`)
      const body = (await me.json()) as {
        preferences?: Record<string, unknown>
      }
      return body.preferences ?? {}
    })
  } finally {
    await context.close()
  }
}
