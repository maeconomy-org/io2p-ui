import { expect, test } from '../fixtures/app'
import { requireCredentials } from '../setup/credentials'
import { tour } from '../utils/selectors'
import { armInitialLoginTour, resetPreferences } from '../utils/preferences'
import { restoreSession, signInAs } from '../utils/session'

/**
 * The welcome tour on a FIRST login, which nothing drives today.
 *
 * `auth.setup.ts` hides this twice over: it reuses `storageState`, so no spec ever performs the
 * sign-in, and `resetPreferences` marks every tour seen on purpose — an armed tour drops
 * `driver-overlay` over every list page and swallows the first click. The bug this covers appeared
 * only on a first login against a COLD React Query cache, which is exactly the state those two
 * things remove.
 *
 * So the case builds it back: arm the tour on the account, then sign in from a browser that has
 * never held a session, and assert on the render that follows.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const primary = requireCredentials()

test.describe.configure({ mode: 'serial' })

test.describe('15 - onboarding / first login', () => {
  test('O8: signing in with the tour armed opens the walkthrough on /objects', async ({
    page,
    browser,
  }) => {
    // Arming needs a session, and the assertion needs a browser that has never had one. Two
    // contexts, in that order.
    const armer = await browser.newContext()
    const armerPage = await armer.newPage()
    await signInAs(armerPage, primary)
    await armInitialLoginTour(armerPage)
    await armer.close()

    await page.goto('/')
    await page.getByLabel('Email').fill(primary.email)
    await page.getByLabel('Password').fill(primary.password)
    await page.getByTestId('auth-email-submit').click()
    await page.waitForURL('**/objects')

    // The tour gates on `resolved` — the `/me` payload having ARRIVED, not merely on auth settling
    // — because the seen-flag has no cookie hint and reads false for everyone before it lands. On a
    // cold cache that is a real wait, so this is the one assertion in the file that needs room.
    await expect(page.locator('.driver-popover')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('O9: dismissing it records the tour, so the next load is clean', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(primary.email)
    await page.getByLabel('Password').fill(primary.password)
    await page.getByTestId('auth-email-submit').click()
    await page.waitForURL('**/objects')

    const popover = page.locator('.driver-popover')
    await expect(popover).toBeVisible({ timeout: 20_000 })

    // `onDestroyStarted` is the single exit path — finishing, closing and ESC all land there, and it
    // is what calls `markSeen`. Without that write the overlay returns on every load forever.
    await page.locator('.driver-popover-close-btn').click()
    await expect(popover).toHaveCount(0)

    // The dismissal writes `markSeen`; give it the round trip before reloading. Reloading straight
    // after the optimistic close races that PATCH — the same race removed from `setLanguage`.
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page.reload()
    // ANCHOR THE ABSENCE TO THE SAME GATE THE POSITIVE ASSERTION WAITS ON. The tour arms only once
    // `/me` has ARRIVED — which is why O8 above needs 20s — and a reload gives a cold cache, so
    // `data-table` can paint well before the tour would have had its chance. Asserting count 0 at
    // that moment samples a popover that has not appeared YET, and a regressed `markSeen` passes.
    // The navbar's user menu renders off the same `/me`, so waiting on it is waiting on the gate.
    await expect(tour(page, 'userMenuTrigger')).toBeVisible({ timeout: 20_000 })
    await expect(popover).toHaveCount(0)
  })

  /**
   * Both halves matter and neither may wait for a pass: `toursSeen` is ACCOUNT state, so a run that
   * fails here otherwise hands an armed tour to every later spec — and the overlay reports as a 60s
   * click timeout that names nothing.
   */
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await restoreSession(page)
    await resetPreferences(page)
    await context.close()
  })
})
