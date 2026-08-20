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

  test('a language the cookie does not know applies without a manual reload', async ({
    page,
    context,
  }) => {
    await setLanguage(page, 'nl')

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
