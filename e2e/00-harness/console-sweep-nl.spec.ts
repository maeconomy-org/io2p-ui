import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { PREF_COOKIE, localeOnlyCookie, setLanguage } from '../utils/language'
import { patchPreferences } from '../utils/preferences'
import { FOOTER_LINKS, NAV_ITEMS, type NavItem } from '@/constants/site'

/**
 * H2 — the same sweep in Dutch, where `consoleGuard` is looking for one thing in particular.
 *
 * `MISSING_MESSAGE` is a next-intl WARNING, and the guard matches it by text for exactly this case:
 * a key present in `en.json` and absent from `nl.json` renders fine in English and silently falls
 * back in Dutch. `1be54b3` pruned 538 keys, so the drift is live rather than theoretical.
 *
 * Parity between the two catalogues is a cheaper check and it is NOT this one — parity proves the
 * files agree with each other, and cannot see a key the CODE asks for that neither file has. Only
 * rendering the page can.
 *
 * A write spec: the interface language is an account preference. `/import`'s wizard steps are the
 * highest-risk page here (`import.steps.<id>` is assembled from an id, so no key-name search finds
 * it), and they are covered where they are actually reachable — `12-import/i18n.spec.ts` I61 drives
 * the wizard itself. A bare visit here only reaches the job-list tab.
 */

function paths(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    item.path,
    ...(item.children ? paths(item.children) : []),
  ])
}

const SIGNED_IN = [
  ...new Set([
    ...paths(NAV_ITEMS),
    ...FOOTER_LINKS.map((link) => link.path),
    '/settings',
  ]),
]

const SIGNED_OUT = ['/', '/forgot-password', '/reset-password']

async function settle(page: Page): Promise<void> {
  await expect(page.getByRole('heading').first()).toBeVisible()
  // A HEADING IS NOT THE ROUTE. Every segment has an `error.tsx`, and that fallback renders one —
  // so a route that crashed into its boundary satisfies the assertion above, and a boundary that
  // swallowed the error (which is its job; production React does not re-throw) leaves nothing for
  // `consoleGuard` either. Without this line the sweep promises "every route renders" and delivers
  // "something with a heading appeared and nothing shouted" — and the crash it was written after
  // was exactly a route unmounting into its boundary.
  await expect(page.getByTestId('error-boundary')).toHaveCount(0)
  // The observation window, not a synchronisation wait — the fixture's assertion is already armed.
  await page.waitForTimeout(1_500)
}

test.describe('00 - harness / console sweep (nl)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await setLanguage(page, 'nl')
    await page.close()
  })

  /**
   * Unconditional, and to a known value. The language is ACCOUNT state that outlives the run, and
   * leaving it on Dutch reddens every later spec keyed on English prose — that cascade cost five
   * specs on 2026-08-31. An `afterAll` runs whether or not these passed; a killed run is the one
   * case it cannot cover, and there is no fix for that short of a disposable account.
   */
  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    try {
      await setLanguage(page, 'en')
    } catch {
      // The UI path can fail for the same reasons the run just did — a dead session, an unhydrated
      // tab, a `toPass` that burns 30s and throws — and then the hook written to PREVENT the
      // eleven-spec Dutch cascade causes it. `patchPreferences` is one API call with no tabs and no
      // hydration, so it survives everything short of the node being down.
      await page.goto('/objects')
      await patchPreferences(page, { locale: { app: 'en' } })
    }
    await page.close()
  })

  // The COOKIE as well as the account. The account alone is not enough and that is not a harness
  // detail: the reconcile that makes a full load honour it is a KNOWN PARKED BUG
  // (`13-preferences/self-heal`), and this guard caught it — every signed-in case rendered `lang=en`
  // while the account said Dutch, sweeping an English console and proving nothing about `nl.json`.
  // The cookie is the server's first-paint source, so seeding it makes the render deterministic
  // without waiting on that fix.
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { ...PREF_COOKIE, value: localeOnlyCookie('nl') },
    ])
  })

  for (const path of SIGNED_IN) {
    test(`H2: ${path} renders in Dutch with a clean console`, async ({
      page,
    }) => {
      await page.goto(path)
      // PROVE IT IS DUTCH before judging its console — the guard the signed-out half already has,
      // and this half needs it more. `beforeAll` sets the account and then this trusted it took;
      // the reconcile that makes it take is a KNOWN parked bug (`13-preferences/self-heal`). An
      // English render sweeps a clean English console and proves nothing about `nl.json`, which is
      // the only thing this file exists for.
      await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
      await settle(page)
    })
  }
})

test.describe('00 - harness / console sweep, signed out (nl)', () => {
  // The COOKIE, not the account: signed out there is no account to read, and the cookie is what the
  // server renders from. So this half writes nothing and cannot leak.
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { ...PREF_COOKIE, value: localeOnlyCookie('nl') },
    ])
  })

  for (const path of SIGNED_OUT) {
    test(`H2: ${path} renders in Dutch signed out, with a clean console`, async ({
      page,
    }) => {
      const response = await page.goto(path)
      // Prove the page really is Dutch before judging its console — an English render would pass
      // this sweep for the wrong reason, since the missing keys are the Dutch ones.
      expect((await response?.text()) ?? '').toContain('lang="nl"')
      await settle(page)
    })
  }
})
