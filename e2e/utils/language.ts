import { expect, type Page } from '@playwright/test'

/** The preference mirror, as Playwright's `addCookies` wants it. */
export const PREF_COOKIE = { name: 'iom_prefs', domain: 'localhost', path: '/' }

/** Only the language field set — the shape a browser that knows nothing else has. */
export function localeOnlyCookie(code: 'en' | 'nl'): string {
  return `1.....${code}`
}

/**
 * Set the interface language on the ACCOUNT, through the settings UI.
 *
 * Account state outlives the run, so every spec that calls this owes a call
 * back to `'en'` before it ends.
 */
export async function setLanguage(
  page: Page,
  code: 'en' | 'nl'
): Promise<void> {
  await page.goto('/settings')
  // `toPass`: a click landing before hydration does nothing at all, silently.
  await expect(async () => {
    await page.getByTestId('settings-tab-appearance').click()
    await expect(page.getByTestId('settings-tab-appearance')).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })

  // The PATCH must be in flight BEFORE the click, or the response is missed and this waits 15s for
  // a request that already landed.
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      r.url().includes('preferences') &&
      r.status() === 200,
    { timeout: 15_000 }
  )

  await expect(async () => {
    await page.getByTestId(`appearance-language-${code}`).click()
    await expect(
      page.getByTestId(`appearance-language-${code}`)
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })

  // `aria-pressed` flips OPTIMISTICALLY, so returning on it hands back a page whose write is still
  // in flight. A caller that then overwrites the preference cookie races that response, which
  // rewrites the cookie from the server's bag — and the language it just set is silently undone.
  await saved
}
