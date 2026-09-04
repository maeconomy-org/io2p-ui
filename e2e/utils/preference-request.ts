import type { Browser } from '@playwright/test'

import { AUTH_STATE } from '../setup/credentials'

/**
 * The account's stored preferences, read from an ALREADY-AUTHENTICATED context.
 *
 * The signed-out cases in `14-auth/pre-login-chrome.read.spec.ts` assert that a theme or language
 * click writes NOTHING to the account. They used to assert that no request matched a pattern, and
 * that was vacuous: measured on 2026-09-04, the app's preference PATCH reaches the node — the
 * account really changes — while neither `page.on('request')` nor the `api` fixture ever records
 * it. Sixty-five requests captured on a write that landed, methods GET and POST only. An assertion
 * denying that request could not have failed whatever the app did.
 *
 * The account is the state those cases are actually about, and a write that happened changes it
 * whether or not anything saw the request.
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
