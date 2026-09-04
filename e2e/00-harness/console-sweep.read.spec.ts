import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { FOOTER_LINKS, NAV_ITEMS, type NavItem } from '@/constants/site'

/**
 * H1 — every shipping route, in English, with nothing in the console.
 *
 * The assertion is `consoleGuard`, which is an auto-fixture: it fails a test on any console error,
 * any `pageerror`, and any `MISSING_MESSAGE` — the last one a next-intl WARNING, so type alone
 * would miss the likeliest i18n failure. So each case here is a navigation, and the fixture is what
 * judges it.
 *
 * This is the cheapest broad net the suite has. Today's Sankey crash was a `pageerror` on a route
 * no spec was listening to; a sweep like this catches that class on its own, without knowing what
 * the bug is.
 *
 * `/import-lab` is excluded deliberately — a frozen fixture-only prototype, and holding it to this
 * bar fails for reasons no user can reach. That it SHIPS is a separate question, which H1b asks.
 */

function paths(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    item.path,
    ...(item.children ? paths(item.children) : []),
  ])
}

// Derived from the app's own nav rather than listed: a hardcoded list does not FAIL when a route
// ships, it just stops covering it. `/rollup-rules` went four commits unvisited that way.
const SIGNED_IN = [
  ...new Set([
    ...paths(NAV_ITEMS),
    ...FOOTER_LINKS.map((link) => link.path),
    '/settings',
  ]),
]

/** Reachable without a session. `/two-factor` is out: it needs a challenge a spec cannot mint. */
const SIGNED_OUT = ['/', '/forgot-password', '/reset-password']

/**
 * Give the page a moment to finish talking after it has painted.
 *
 * Not a synchronisation wait — the assertion has already been armed by the fixture, and this is the
 * observation window. A route that logs on a lazily-loaded chunk or a settling query would
 * otherwise be judged before it has spoken.
 */
async function settle(page: Page): Promise<void> {
  await expect(page.getByRole('heading').first()).toBeVisible()
  // A HEADING IS NOT THE ROUTE. Every segment has an `error.tsx`, and that fallback renders one —
  // so a route that crashed into its boundary satisfies the assertion above, and a boundary that
  // swallowed the error (which is its job; production React does not re-throw) leaves nothing for
  // `consoleGuard` either. Without this line the sweep promises "every route renders" and delivers
  // "something with a heading appeared and nothing shouted" — and the crash it was written after
  // was exactly a route unmounting into its boundary.
  await expect(page.getByTestId('error-boundary')).toHaveCount(0)
  await page.waitForTimeout(1_500)
}

test.describe('00 - harness / console sweep (en)', () => {
  for (const path of SIGNED_IN) {
    test(`H1: ${path} renders with a clean console`, async ({ page }) => {
      await page.goto(path)
      await settle(page)
    })
  }

  test('H1: /objects/[uuid] renders with a clean console', async ({ page }) => {
    await page.goto('/objects')
    const row = page.getByTestId('data-table-row').first()
    await expect(row).toBeVisible()
    // The id is never known ahead of time, and a child route is a different render from its list —
    // it carries the breadcrumb trail and the parent header.
    await row.dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await settle(page)
  })

  test('H1b: no swept route links to the lab prototype', async ({ page }) => {
    // EVERY swept route, not just `/objects` — the earlier version checked one page and was named
    // as though it covered the app, so a link from anywhere else passed.
    //
    // That it ships in the production bundle at all is a note for `03-known-issues.md` rather than a
    // failure here. What must stay true is that nothing LINKS to it.
    for (const path of SIGNED_IN) {
      await page.goto(path)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await expect(page.locator('a[href*="import-lab"]')).toHaveCount(0)
    }
  })
})

test.describe('00 - harness / console sweep, signed out (en)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const path of SIGNED_OUT) {
    test(`H1: ${path} renders signed out with a clean console`, async ({
      page,
    }) => {
      await page.goto(path)
      await settle(page)
    })
  }
})
