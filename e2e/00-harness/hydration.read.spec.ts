import { expect, test } from '../fixtures/app'

/**
 * §6.1 — no route may mismatch on hydration.
 *
 * A RELOAD is the case that matters, and the one no other spec exercises: the first visit to a
 * route is a client navigation with no SSR pass at all, so a mismatch only appears when the page is
 * server-rendered and then hydrated.
 *
 * The bug this pins: anything read from a node-stored preference differs between the server (which
 * cannot know it) and the browser (which restores auth from localStorage synchronously, so its
 * FIRST render already has the stored value). `/objects` and `/processes` both failed, and they
 * were exactly the two pages gating on `usePreference`'s `resolved`. `usePreference` is now
 * hydration-safe; this keeps it that way, and covers every future consumer for free.
 */

const ROUTES = [
  '/objects',
  '/processes',
  '/shares',
  '/templates',
  '/formulas',
  '/constants',
  '/import',
  '/settings',
] as const

test.describe('00 - harness / hydration', () => {
  for (const path of ROUTES) {
    test(`${path} hydrates without a mismatch`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      await page.goto(path)
      // Settle first: reloading mid-render can leave the request in flight and prove nothing.
      await expect(page.getByRole('heading').first()).toBeVisible()

      await page.reload()
      await expect(page.getByRole('heading').first()).toBeVisible()

      // `expect.poll` — a hydration error surfaces a tick or two after the markup appears, so a
      // bare read here passes before React has had the chance to complain.
      await expect
        .poll(() => errors.filter((text) => /[Hh]ydration/.test(text)).length, {
          message: `hydration errors on ${path}`,
          timeout: 4000,
        })
        .toBe(0)
    })
  }
})
