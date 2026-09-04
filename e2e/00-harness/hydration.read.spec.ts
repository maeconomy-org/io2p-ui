import { expect, test } from '../fixtures/app'
import { FOOTER_LINKS, NAV_ITEMS, type NavItem } from '@/constants/site'

/**
 * §6.1 — no route may mismatch on hydration.
 * server-rendered and then hydrated.
 * The bug this pins: anything read from a node-stored preference differs between the server (which
 */

function paths(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    item.path,
    ...(item.children ? paths(item.children) : []),
  ])
}

// Derived from the app's own nav rather than listed: a hardcoded list does not FAIL when a route
// ships, it just stops covering it. `/rollup-rules` went four commits unvisited that way.
const ROUTES = [
  ...new Set([
    ...paths(NAV_ITEMS),
    ...FOOTER_LINKS.map((link) => link.path),
    '/settings',
  ]),
]

test.describe('00 - harness / hydration', () => {
  for (const path of ROUTES) {
    test(`${path} hydrates without a mismatch`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      await page.goto(path)
      await expect(page.getByRole('heading').first()).toBeVisible()

      await page.reload()
      await expect(page.getByRole('heading').first()).toBeVisible()

      // `expect.poll` — a hydration error surfaces a tick or two after the markup appears, so a
      await expect
        .poll(() => errors.filter((text) => /[Hh]ydration/.test(text)).length, {
          message: `hydration errors on ${path}`,
          timeout: 4000,
        })
        .toBe(0)
    })
  }
})
