import { expect, type Page } from '@playwright/test'

/** The preference mirror, as Playwright's `addCookies` wants it. */
export const PREF_COOKIE = { name: 'iom_prefs', domain: 'localhost', path: '/' }

/** Only the language field set — the shape a browser that knows nothing else has. */
export function localeOnlyCookie(code: 'en' | 'nl'): string {
  return `1.....${code}`
}

/**
 * `/settings`, with the Appearance tab open.
 *
 * A reload does NOT keep the tab — it resets to Account, and Radix unmounts the panel it was on, so
 * the language options simply stop existing. Anything that reloads has to come back through here.
 */
async function openAppearance(page: Page): Promise<void> {
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
}

/**
 * Set the interface language on the ACCOUNT, through the settings UI.
 *
 * Account state outlives the run, so every spec that calls this owes a call back to `'en'` before
 * it ends.
 *
 * ⚠ UNSAFE ON A FRESH CONTEXT — use `patchPreferences(page, { locale: { app: 'en' } })` instead.
 * The early-return below reads `aria-pressed`, which reflects the COOKIE-derived first paint. A
 * context with no `iom_prefs` first-paints English whatever the account says, so on an account
 * stored as Dutch this helper sees English, writes nothing, returns — and the app renders Dutch the
 * moment `/me` resolves. That is `13-preferences/self-heal`'s parked bug arriving from the other
 * side, and it cost two four-minute runs in `11-shares/shared-process.spec.ts` before it was found.
 * The API path has no control to misread.
 */
export async function setLanguage(
  page: Page,
  code: 'en' | 'nl'
): Promise<void> {
  await openAppearance(page)

  const option = page.getByTestId(`appearance-language-${code}`)
  await expect(option).toBeVisible()

  // Already there — usually a RESTORE in an `afterEach`, and a run that failed before changing
  // anything hits this every time. Selecting the current language writes nothing, so anything that
  // waited for a PATCH here would hang, fail the hook, and leave the account on whatever language
  // the run was in. That is the cascade this helper exists to prevent: one un-restored locale
  // reddens every later spec keyed on English prose.
  if ((await option.getAttribute('aria-pressed')) === 'true') return

  // A visible control is not a hydrated one — a click landing before the handler is attached does
  // nothing at all, silently. `toPass` re-clicks until the control reports the new state.
  await expect(async () => {
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true', {
      timeout: 3_000,
    })
  }).toPass({ timeout: 30_000 })

  // `aria-pressed` flips OPTIMISTICALLY, so returning on it hands back a page whose write is still
  // in flight. A caller that then overwrites the preference cookie races that response, which
  // rewrites the cookie from the server's bag — and the language it just set is silently undone.
  //
  // A RELOAD rather than a `waitForResponse`: the retry loop above can swallow the first click and
  // land the real one up to 30s later, which outlives any response wait short enough to be useful.
  // Racing the PATCH cost a whole run — the wait expired, the restore failed, and the account went
  // to the next spec in Dutch.
  await page.reload()
  await openAppearance(page)
  await expect(page.getByTestId(`appearance-language-${code}`)).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 }
  )
}
