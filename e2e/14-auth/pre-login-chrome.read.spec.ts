import { expect, test } from '../fixtures/app'
import { PREF_COOKIE } from '../utils/language'

/**
 * Theme and language are settable BEFORE there is an account to store them on.
 *
 * The half worth pinning is what the controls must NOT do. `usePreferencePatch`
 * returns early when signed out, so the choice reaches the cookie and nothing
 * else; before that guard every click fired a `PATCH /me/preferences` that 401'd
 * silently, because `onError` only restores the cache.
 *
 * `.read.`: this file never signs in, so it writes nothing to the node and
 * cannot end the session the rest of the suite runs on. The signed-in half —
 * the account winning over a contradicting cookie — is `locale-on-login.spec.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] } })

/** Never a default: §4.13. Each case seeds the value it is about to change. */
function prefs(theme: 'l' | 'd', locale: 'en' | 'nl'): string {
  return `1.t.t.20.${theme}.${locale}`
}

const PATCH_PREFERENCES = /\/me\/preferences/

test.describe('14 - auth / pre-login chrome', () => {
  test('AU19: the language chosen before sign-in reaches the SERVER render', async ({
    page,
    context,
    api,
  }) => {
    await context.addCookies([{ ...PREF_COOKIE, value: prefs('l', 'en') }])
    await page.goto('/')

    const chrome = page.getByTestId('auth-chrome')
    await chrome.getByTestId('language-select').click()
    // The option labels are the language's own endonym and are NOT translated,
    // so this locator survives the switch it performs.
    await page.getByRole('menuitem', { name: 'Nederlands' }).click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')

    // The document, not the hydrated DOM. `useSetLocale` writes the cookie and
    // calls `router.refresh()`; asserting on the markup is what proves the
    // refreshed request carried the new value rather than the client patching
    // over an English render.
    const response = await page.goto('/')
    expect((await response?.text()) ?? '').toContain('lang="nl"')
    await expect(page.getByText('Hulp nodig met authenticatie?')).toBeVisible()

    expect(api.matching(PATCH_PREFERENCES)).toEqual([])
  })

  test('AU20: the theme chosen before sign-in survives a reload', async ({
    page,
    context,
    api,
  }) => {
    await context.addCookies([{ ...PREF_COOKIE, value: prefs('l', 'en') }])
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.getByTestId('auth-chrome').getByTestId('theme-select').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // next-themes bakes the cookie-derived value into a blocking script, so a
    // choice that only lived in React state would be gone by the next paint.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveClass(/dark/)

    expect(api.matching(PATCH_PREFERENCES)).toEqual([])
  })

  test('AU21: no account write is attempted for either control', async ({
    page,
    context,
    api,
  }) => {
    await context.addCookies([{ ...PREF_COOKIE, value: prefs('d', 'nl') }])
    await page.goto('/')

    await page.getByTestId('auth-chrome').getByTestId('theme-select').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.getByTestId('auth-chrome').getByTestId('language-select').click()
    await page.getByRole('menuitem', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Both directions, from the opposite starting state to AU19/AU20 — a guard
    // that only skipped the write in one direction would pass those two.
    expect(api.matching(PATCH_PREFERENCES)).toEqual([])
  })
})
