import { expect, test } from '../fixtures/app'
import { setLanguage } from '../utils/language'
import { patchPreferences } from '../utils/preferences'

/**
 * Preferences are a property of the ACCOUNT, not of this browser.
 *
 * Deliberately not a `.read.` spec: every case here writes to the node, and the
 * suite shares one login. Each test restores what it changed, in the same way
 * `auth.setup.ts` normalises the view.
 */

test.describe.configure({ mode: 'serial' })

/**
 * Two silent failures here: a click landing before hydration does nothing, and the write is
 * optimistic — two writes in flight can land out of order and the later response wins. Waiting for
 * the cookie mirror makes each call a completed step.
 */
async function setPageSize(
  page: import('@playwright/test').Page,
  size: string
) {
  await page.goto('/settings')
  await page.getByTestId('settings-tab-preferences').click()
  await expect(async () => {
    await page.getByTestId('pref-page-size-trigger').click()
    await page.getByTestId(`pref-page-size-${size}`).click()
    await expect(page.getByTestId('pref-page-size-trigger')).toContainText(
      size,
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const jar = await page.context().cookies()
      return jar.find((c) => c.name === 'iom_prefs')?.value ?? ''
    })
    .toContain(`.${size}.`)
}

test.describe('13 - preferences / persistence', () => {
  // Restores after EVERY case, so no test relies on what a previous one set.
  test.afterEach(async ({ page }) => {
    await setPageSize(page, '20')
  })

  test('one page size serves every table', async ({ page }) => {
    await setPageSize(page, '50')

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('page-size')).toContainText('50')
  })

  // `TablePagination` returns null when `totalPages <= 1`, so an account with no shares renders no
  // page-size control at all — the query string is the only thing true whatever the row count.
  test('the same page size reaches the /shares query', async ({
    page,
    api,
  }) => {
    await setPageSize(page, '50')

    api.clear()
    await page.goto('/shares')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await expect.poll(() => api.count(/\/v1\/shares\?.*size=50/)).toBe(1)
  })

  test('the page size survives a reload', async ({ page }) => {
    await setPageSize(page, '50')

    await page.reload()
    await page.getByTestId('settings-tab-preferences').click()

    await expect(page.getByTestId('pref-page-size-trigger')).toContainText('50')
  })
})

test.describe('13 - preferences / language', () => {
  /**
   * Unconditional, and to a known value. The interface language is ACCOUNT state that outlives the
   * run, and a spec left on Dutch reddens every later case keyed on English prose — it cost eleven
   * specs in `07-processes` once. An inline restore at the end of the happy path only runs when the
   * test passed, and the run where it matters is the run where it failed.
   */
  test.afterEach(async ({ page }) => {
    try {
      await setLanguage(page, 'en')
    } catch {
      // The UI path can fail for the same reasons the run just did — a dead session, an unhydrated
      // tab, a `toPass` that burns 30s and throws — and then the hook written to PREVENT the Dutch
      // cascade causes it. `patchPreferences` is one API call with no tabs and no hydration, so it
      // survives everything short of the node being down. Same fallback as `console-sweep-nl`.
      await page.goto('/objects')
      await patchPreferences(page, { locale: { app: 'en' } })
    }
  })

  test('switching language does not reload the document', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-appearance').click()

    // A sentinel on `window` survives a React transition and dies with a full
    // document load. That is the difference between `router.refresh()` and the
    // `location.reload()` this replaced.
    await page.evaluate(() => {
      ;(window as unknown as { __probe?: string }).__probe = 'alive'
    })

    await page.getByTestId('appearance-language-nl').click()
    await expect(page.getByTestId('appearance-language-nl')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    expect(
      await page.evaluate(
        () => (window as unknown as { __probe?: string }).__probe
      )
    ).toBe('alive')
  })

  /**
   * SE4 — the language switch reaches the INTERFACE, and the account keeps it.
   *
   * The case above asserts `aria-pressed` on the control, which is the switch reporting on itself.
   * A locale that is stored and never rendered satisfies that and nothing else, so this one reads
   * the navbar on a different route instead — translated prose the switch does not own.
   *
   * The reload is the second half. `13-preferences/self-heal.spec.ts` parks the case where the
   * cookie CONTRADICTS the account; here `PreferenceSync` has written the mirror itself, which is
   * what an ordinary user's next visit looks like, and that path is expected to work.
   */
  test('SE4: the switch reaches the navbar, and a reload keeps it', async ({
    page,
  }) => {
    // English FIRST, set rather than assumed — a previous run stores a language, so there is no
    // starting value to assert. Without this the Dutch assertions below can pass on a page that was
    // never English to begin with.
    await setLanguage(page, 'en')
    await page.goto('/objects')
    await expect(page.getByRole('link', { name: 'Objects' })).toBeVisible()

    await setLanguage(page, 'nl')

    await page.goto('/objects')
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
    // The NAVBAR, on a route that is not the one carrying the switch. It is a Client Component
    // reading the catalogue the root layout shipped, so it is the part a client-side locale change
    // cannot fake.
    await expect(page.getByRole('link', { name: 'Objecten' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Objects' })).toHaveCount(0)

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
    await expect(page.getByRole('link', { name: 'Objecten' })).toBeVisible()
  })
})
