import { expect, test } from '../fixtures/app'

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

  test('no page skeleton appears while the account loads', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ ...COOKIE, value: '1.t.t.20.y.en' }])

    let skeletonSeen = false
    await page.goto('/objects', { waitUntil: 'commit' })
    // `page-skeleton` is the ROUTE boundary specifically. A bare `.animate-pulse`
    // would also match DataTable's own loading rows, which are correct and
    // expected — the point is that nothing covers the heading and the filters.
    for (let i = 0; i < 20; i++) {
      if ((await page.getByTestId('page-skeleton').count()) > 0)
        skeletonSeen = true
      await page.waitForTimeout(50)
    }

    expect(skeletonSeen).toBe(false)
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('the stored page size drives the FIRST list request', async ({
    page,
    context,
    api,
  }) => {
    await context.addCookies([{ ...COOKIE, value: '1.t.t.50.y.en' }])

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Asserted on the REQUEST, not on the size Select. The control reads its
    // value back off the response, so it would show 50 even if the request had
    // asked for 20 and the server had simply echoed what it was given.
    // `_rsc` filtered out: Next's own route prefetch also hits `/objects?`, and
    // it arrives FIRST, so an unfiltered match reads the navigation instead of
    // the list call.
    const listCalls = () =>
      api.matching(/\/objects\?/).filter((r) => !r.path.includes('_rsc'))
    await expect.poll(() => listCalls().length).toBeGreaterThan(0)
    expect(listCalls()[0].path).toContain('size=50')
  })
})
