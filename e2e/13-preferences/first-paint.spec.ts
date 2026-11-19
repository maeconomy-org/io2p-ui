import { expect, test } from '../fixtures/app'
import { patchPreferences } from '../utils/preferences'

/**
 * The preference cookie is the FIRST-PAINT mirror of the account's settings.
 *
 * Every assertion here reads the INITIAL HTML, not the hydrated DOM. That
 * distinction is the whole point: the hydrated DOM is correct either way once
 * `/me` lands, so a DOM assertion would pass for a build that still flashes.
 *
 * Seeding the cookie directly is legitimate rather than a shortcut — it is a
 * hint the app is required to honour, and honouring a hint the account later
 * contradicts is covered by `self-heal.spec.ts`.
 */

const COOKIE = { name: 'iom_prefs', domain: 'localhost', path: '/' }

test.describe('13 - preferences / first paint', () => {
  // The size case stores 50 on the account; put the default back whatever happened.
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/objects')
    await patchPreferences(page, { defaults: { pageSize: 20 } })
    await context.close()
  })

  test('the server renders the stored view, not the default', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ ...COOKIE, value: '1.c.n.50.d.nl' }])

    const response = await page.goto('/objects')
    const html = (await response?.text()) ?? ''

    // The columns view replaces the table outright, so the table's own testid is
    // the negative signal and it must be absent from the very first byte.
    expect(html).not.toContain('data-testid="data-table"')
  })

  test('the server renders the stored language', async ({ page, context }) => {
    await context.addCookies([{ ...COOKIE, value: '1.t.t.20.d.nl' }])

    const response = await page.goto('/objects')
    const html = (await response?.text()) ?? ''

    expect(html).toContain('lang="nl"')
  })

  test('the theme is applied before hydration', async ({ page, context }) => {
    await context.addCookies([{ ...COOKIE, value: '1.t.t.20.d.en' }])

    await page.goto('/objects', { waitUntil: 'domcontentloaded' })

    // next-themes bakes the cookie-derived default into its blocking script, so
    // the class is on <html> before the first paint rather than after `/me`.
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  // The claim is about the ACCOUNT read: with the cookie, nothing waits for `/me` to paint. `/me`
  // is held until the list has drawn rows, and an observer records every DOM change from the first
  // paint until `/me` has answered, so a skeleton that flashes for one frame still counts. A hard load also streams the
  // route's `loading.tsx` ahead of the page, before any account read; that is before the first
  // paint of the page and not what this asserts.
  test('no page skeleton appears while the account loads', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ ...COOKIE, value: '1.t.t.20.y.en' }])
    await page.addInitScript(() => {
      const flags = { painted: false, skeletonAfterPaint: false }
      ;(window as unknown as { __firstPaint: typeof flags }).__firstPaint =
        flags
      new MutationObserver(() => {
        const skeleton = document.querySelector('[data-testid="page-skeleton"]')
        // Streaming parks the page in a hidden div beside the fallback until React swaps them, so
        // the page has painted only once its table is there AND the fallback is gone.
        if (document.querySelector('[data-testid="data-table"]') && !skeleton) {
          flags.painted = true
        }
        if (flags.painted && skeleton) flags.skeletonAfterPaint = true
      }).observe(document, { childList: true, subtree: true })
    })
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    let meAsked = false
    await page.route(/\/v1\/me$/, async (route) => {
      meAsked = true
      await held
      await route.continue()
    })

    await page.goto('/objects')
    // Held until the list has answered and drawn its rows: proof the page did not wait for `/me`.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    expect(meAsked).toBe(true)

    const answered = page.waitForResponse((r) => /\/v1\/me$/.test(r.url()))
    release()
    await answered
    await expect(page.getByTestId('data-table')).toBeVisible()
    const flags = await page.evaluate(
      () =>
        (window as unknown as { __firstPaint: Record<string, boolean> })
          .__firstPaint
    )
    expect(flags).toEqual({ painted: true, skeletonAfterPaint: false })
  })

  // A returning user whose account and cookie both say 50. `/me` is HELD until the list has asked,
  // so the size can only have come from the cookie: without the hold the account answers first on
  // a fast node, and the case passes whether or not the hint is read.
  test('the stored page size drives the FIRST list request', async ({
    page,
    context,
    api,
  }) => {
    await page.goto('/objects')
    await patchPreferences(page, { defaults: { pageSize: 50 } })
    await context.addCookies([{ ...COOKIE, value: '1.t.t.50.y.en' }])

    const listCalls = () =>
      api.matching(/\/objects\?/).filter((r) => !r.path.includes('_rsc'))
    let release: () => void = () => {}
    const listAsked = new Promise<void>((resolve) => (release = resolve))
    page.on('request', (r) => {
      if (/\/api\/v1\/objects\?/.test(r.url())) release()
    })
    await page.route('**/api/v1/me', async (route) => {
      await listAsked
      await route.continue()
    })

    api.clear()
    await page.goto('/objects')
    // Asserted on the REQUEST, not on the size Select, which reads its value back off the response.
    await expect
      .poll(() => listCalls().length, {
        message:
          'the list never asked while /me was held — it waits for the account',
      })
      .toBeGreaterThan(0)
    expect(listCalls()[0].path).toContain('size=50')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })
})
