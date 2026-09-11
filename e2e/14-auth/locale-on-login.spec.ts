import { expect, test } from '../fixtures/app'
import { requireCredentials } from '../setup/credentials'
import { PREF_COOKIE, localeOnlyCookie, setLanguage } from '../utils/language'

/**
 * The account language must survive a sign-in, on a browser whose cookie
 * disagrees.
 *
 * `13-preferences/self-heal.spec.ts` covers the same contradiction on a FULL
 * page load, and passes without any of this. Sign-in is the harder half: the
 * login page ships the English catalogue, and `router.replace('/objects')` is a
 * CLIENT navigation, which re-renders the segment and never the root layout
 * that owns the catalogue. Without the reconcile in `PreferenceSync` the user
 * lands half translated — Dutch headings inside an English navbar.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const { email, password } = requireCredentials()

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByTestId('auth-email-submit').click()
}

test.describe('14 - auth / locale on login', () => {
  /**
   * ⏸ DEFERRED — the same reconcile gap as `13-preferences/self-heal.spec.ts`, arriving through the
   * login form instead of a full load. See `docs/e2e-docs/e2e-run-2026-08-31.md` "Still open" #1.
   *
   * `test.fail` rather than `test.fixme`, for the reason spelled out in that file: a spec that never
   * runs leaves the bug uncovered and rots. This one goes red the day the reconcile is fixed.
   *
   * `test.fixme`, NOT `test.fail`, and that was measured rather than assumed. `.fail` is the better
   * tool in the abstract — it runs the case and goes red the day the bug is fixed, where `.fixme`
   * leaves the bug uncovered and lets the spec rot. But these two are DESTRUCTIVE to a shared
   * account: they switch the interface language, and their restore is not reliable enough to run
   * every suite. Armed with `.fail` they left the account in Dutch and reddened eleven specs in
   * `07-processes` that never touch language, each burning a 60s timeout on `getByLabel(/name/i)`
   * against a form reading "Naam". `.fixme` is the cheaper wrong answer here.
   */
  test.fixme('a Dutch account signing in from an English login page lands in Dutch', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await signIn(page)
    await expect(page).toHaveURL(/\/objects$/)
    await setLanguage(page, 'nl')

    // Drop the session, then hand this browser a cookie that has only ever
    // heard English — a first sign-in on a new machine. Clearing rather than
    // signing out keeps the case away from the account menu's selectors.
    await context.clearCookies()
    await context.addCookies([
      { ...PREF_COOKIE, value: localeOnlyCookie('en') },
    ])

    const response = await page.goto('/')
    expect((await response?.text()) ?? '').toContain('lang="en"')

    await signIn(page)
    await expect(page).toHaveURL(/\/objects$/)

    // NO reload between the sign-in and these. The navbar is the half a client
    // navigation cannot correct, so it is the one that has to be asserted.
    await expect(page.getByRole('link', { name: 'Objecten' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  })

  // Account state outlives the run, and an inline reset only runs when the test PASSES — the run
  // where it matters is the run where it failed, which then hands Dutch to every later spec. The
  // session is signed in here rather than reused: this file clears its own cookies.
  test.afterEach(async ({ page }) => {
    await page.goto('/')
    if (!/\/objects$/.test(page.url())) await signIn(page)
    await setLanguage(page, 'en')
  })
})
