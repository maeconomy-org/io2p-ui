import { expect, test } from '../fixtures/app'
import { PREF_COOKIE, localeOnlyCookie, setLanguage } from '../utils/language'

/**
 * The cookie is a HINT. This file covers the case where the account contradicts
 * it — a language chosen on another device, landing on a FULL page load.
 *
 * `first-paint.spec.ts` covers the other half: honouring the hint before `/me`
 * has answered. `14-auth/locale-on-login.spec.ts` covers the same contradiction
 * arriving through the login form, where the navigation is a client one.
 *
 * Everything here writes ACCOUNT state, which outlives the run, so the language
 * goes back to English at the end of every test.
 */

test.describe('13 - preferences / self heal', () => {
  test.afterEach(async ({ page }) => {
    await setLanguage(page, 'en')
  })

  /**
   * ⏸ DEFERRED — a known product gap, deliberately not chased. See
   * `docs/e2e-docs/e2e-run-2026-08-31.md` "Still open" #1.
   *
   * The account says Dutch, the browser is handed a cookie that has only ever heard English, and on
   * a FULL page load the navbar stays English — `PreferenceSync`'s locale reconcile does not take.
   * The spec is RIGHT and reproduces the bug; it is parked so a known gap does not read as an
   * unstable suite. Delete the `.fixme` when the reconcile is fixed.
   */
  test.fixme('a language the cookie does not know applies without a manual reload', async ({
    page,
    context,
  }) => {
    await setLanguage(page, 'nl')

    // `PreferenceSync` is the only writer of this cookie and it rewrites it
    // whenever a mounted page disagrees. Seeding while `/settings` is still up
    // hands the value straight back to that effect, so leave the app first.
    await page.goto('about:blank')

    // Only the language field, so the load starts from the same place a first
    // login does: the account says Dutch and this browser has never heard it.
    await context.addCookies([
      { ...PREF_COOKIE, value: localeOnlyCookie('en') },
    ])

    const response = await page.goto('/objects')
    expect((await response?.text()) ?? '').toContain('lang="en"')

    // The navbar is a Client Component, so it reads the catalogue the ROOT
    // LAYOUT shipped. That is the half a client navigation cannot correct, and
    // the half the user saw stay English while the page heading turned Dutch.
    await expect(page.getByRole('link', { name: 'Objecten' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  })
})
