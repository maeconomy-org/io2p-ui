import type { Page } from '@playwright/test'

import { PREFERENCES } from '@/constants/preferences'

/**
 * Every preference at its registry default, as one `PATCH me/preferences` bag.
 *
 * Derived from `PREFERENCES` rather than listed here: a key added to the registry is reset from
 * the day it lands, instead of waiting for someone to notice a spec failing on state the previous
 * run left behind.
 */
function defaultsPatch(): Record<string, Record<string, unknown>> {
  const patch: Record<string, Record<string, unknown>> = {}
  for (const [name, spec] of Object.entries(PREFERENCES)) {
    patch[spec.ns] ??= {}
    patch[spec.ns][spec.key ?? name] = spec.default
  }
  return patch
}

/**
 * Reset the account to its default preferences.
 *
 * Preferences are ACCOUNT state stored on the node, so they outlive a run: a spec that leaves
 * `/processes` in the Sankey view, an access scope on `shared`, or a hidden column breaks unrelated
 * specs in the NEXT run, and the failure looks exactly like an app regression.
 *
 * Runs in the page so it borrows the session cookie and `__IOM_CONFIG__` — a `page.request` call
 * carries the cookie but cannot mint the short-lived core token the node wants.
 */
export async function resetPreferences(page: Page): Promise<void> {
  const patch = defaultsPatch()

  const failure = await page.evaluate(async (body) => {
    const config = (
      window as unknown as {
        __IOM_CONFIG__?: { authBaseUrl?: string; coreBaseUrl?: string }
      }
    ).__IOM_CONFIG__
    if (!config?.authBaseUrl || !config?.coreBaseUrl) {
      return 'runtime config missing authBaseUrl/coreBaseUrl'
    }

    const minted = await fetch(`${config.authBaseUrl}/api/auth/token`, {
      credentials: 'include',
    })
    if (!minted.ok) return `token mint failed: ${minted.status}`
    const { token } = (await minted.json()) as { token?: string }
    if (!token) return 'token endpoint returned no token'

    const res = await fetch(`${config.coreBaseUrl}/api/v1/me/preferences`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    return res.ok ? null : `PATCH me/preferences failed: ${res.status}`
  }, patch)

  if (failure) {
    throw new Error(`Could not reset preferences — ${failure}`)
  }
}
