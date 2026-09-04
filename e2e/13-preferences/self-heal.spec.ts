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
   * ⏸ DEFERRED — a known product gap. See `docs/e2e-docs/e2e-run-2026-08-31.md` "Still open" #1.
   *
   * `test.fail`, NOT `test.fixme`. The spec is right and reproduces the bug, so `.fixme` would have
   * left that bug with zero coverage AND let the spec rot against unrelated refactors until someone
   * deleted it as stale. `.fail` runs it, expects the failure, and turns the suite RED the day it
   * starts passing — so the reconcile fix announces itself instead of waiting for someone to
   * remember this file.
   *
   * The account says Dutch, the browser is handed a cookie that has only heard English, and on a
   * FULL page load the navbar stays English — `PreferenceSync`'s locale reconcile does not take.
   *
   * `test.fixme`, NOT `test.fail`, and that was measured rather than assumed. `.fail` is the better
   * tool in the abstract — it runs the case and goes red the day the bug is fixed, where `.fixme`
   * leaves the bug uncovered and lets the spec rot. But these two are DESTRUCTIVE to a shared
   * account: they switch the interface language, and their restore is not reliable enough to run
   * every suite. Armed with `.fail` they left the account in Dutch and reddened eleven specs in
   * `07-processes` that never touch language, each burning a 60s timeout on `getByLabel(/name/i)`
   * against a form reading "Naam". `.fixme` is the cheaper wrong answer here.
   */
  test.fixme('a language the cookie does not know applies without a manual reload', async ({
    page,
    context,
  }) => {
    // English FIRST, explicitly. This case's whole premise is that the account contradicts the
    // cookie, and `setLanguage` returns early when the language is already the one asked for — so
    // on a run that inherited a Dutch account the switch below wrote nothing, the contradiction
    // never existed, and the case passed. It assumed a default, which is the one thing §4.13 says
    // no spec may do. Measured: alternating start locales gave alternating results.
    await setLanguage(page, 'en')
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
