import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * §6.2 — navigation.
 *
 * `.read.` — nothing here creates anything, so these run four-wide in parallel.
 *
 * The headline case is N4. `01-smoke/navigation.spec.ts` TC006 visited `/groups` and asserted the
 * absence of the string "Application error", which a not-found page satisfies — so a deleted route
 * reported green. Asserting a page LANDMARK instead of the absence of an error string is the whole
 * correction, and it applies to every case here.
 */

/** Every route that ships. The two `-lab` routes are fixture-only prototypes and excluded. */
const ROUTES = [
  { path: '/objects', heading: /objects/i },
  { path: '/processes', heading: /processes/i },
  { path: '/shares', heading: /shares/i },
  { path: '/templates', heading: /templates/i },
  { path: '/formulas', heading: /formulas/i },
  { path: '/constants', heading: /constants/i },
  { path: '/import', heading: /import/i },
  { path: '/settings', heading: /settings/i },
  { path: '/help', heading: /help/i },
] as const

test.describe('01 - navigation', () => {
  for (const route of ROUTES) {
    test(`N1: ${route.path} renders its own page`, async ({ page }) => {
      await page.goto(route.path)

      // A landmark, not the absence of an error: a 404 shell has no error string either.
      await expect(
        page.getByRole('heading', { name: route.heading }).first()
      ).toBeVisible()
    })
  }

  test('N4: /groups is not-found — the route was deleted, not renamed', async ({
    page,
    consoleGuard,
  }) => {
    // A route that does not exist SHOULD 404. Declared here rather than added to the module-level
    // ignore list, which would hide a real 404 in every other test.
    consoleGuard.expectError(/404 \(Not Found\)/)
    await page.goto('/groups')

    // The regression TC006 hid for months. /groups was replaced by /shares, which is not a rename:
    // a Share bundles resources and lists members inline.
    await expect(
      page.getByRole('heading', { name: /page not found/i })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /go home/i })).toBeVisible()
  })

  test('N10: an unknown route is not-found, and Go Home returns', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/404 \(Not Found\)/)
    await page.goto('/this-route-does-not-exist')

    const goHome = page.getByRole('link', { name: /go home/i })
    await expect(goHome).toBeVisible()
    await goHome.click()

    await expect(page).not.toHaveURL(/this-route-does-not-exist/)
  })

  test('N2/N3: the Library dropdown exposes three children and stays active on them', async ({
    page,
  }) => {
    await page.goto('/objects')

    // Open the menu and PROVE it, before asking about its contents. Radix mounts the items and then
    // animates the panel, so an item can resolve in the DOM while the menu is still closed — which
    // reads as "element not visible" and looks like a missing item. The trigger's own
    // `aria-expanded` is the unambiguous signal.
    await tour(page, 'navLibrary').click()
    await expect(tour(page, 'navLibrary')).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    // Scoped to the open menu, so a hidden mobile-nav copy of the same link cannot satisfy it.
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem')).toHaveCount(3)
    await expect(
      menu.getByRole('menuitem', { name: /template/i })
    ).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /formula/i })).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: /constant/i })
    ).toBeVisible()

    await menu.getByRole('menuitem', { name: /formula/i }).click()
    await expect(page).toHaveURL(/\/formulas/)

    // N3: the group-active rule — a child route keeps the PARENT marked, or the user loses their
    // place in the nav the moment they use the menu.
    await expect(tour(page, 'navLibrary')).toHaveClass(/text-primary/)
  })

  test('N5: the footer reaches /help', async ({ page }) => {
    await page.goto('/objects')
    // Wait for the page to finish settling before clicking. A client navigation started mid-render
    // gets overtaken by the one already in flight, and the URL lands back on /objects.
    await expect(page.getByTestId('data-table')).toBeVisible()

    // `/import-status` is gone — the job list is a tab on `/import` now, and site.ts carries one
    // import entry, not two.
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: /help/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/help/)
  })

  test('N6: the advertised mod+K opens the command centre, and Esc closes it', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(tour(page, 'searchButton')).toBeVisible()

    // The modifier is derived from the USER AGENT, because that is what `useHotkeys('mod+k')`
    // reads. Playwright's `ControlOrMeta` resolves against the HOST os instead, and the two
    // disagree in headless Chromium — its UA reports Windows while `navigator.platform` reports
    // MacIntel, so `mod` is Ctrl there and Meta on a real Mac. Hardcoding either makes this pass
    // on one machine and hang for 60s on the other.
    const isApple = await page.evaluate(() =>
      /mac|iphone|ipad/i.test(navigator.userAgent)
    )
    await page.keyboard.press(isApple ? 'Meta+k' : 'Control+k')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('N1b: each nav item routes and marks itself active', async ({
    page,
  }) => {
    await page.goto('/objects')

    await tour(page, 'navProcesses').click()
    await expect(page).toHaveURL(/\/processes/)
    await expect(tour(page, 'navProcesses')).toHaveClass(/text-primary/)

    await tour(page, 'navShares').click()
    await expect(page).toHaveURL(/\/shares/)
    await expect(tour(page, 'navShares')).toHaveClass(/text-primary/)
  })
})
