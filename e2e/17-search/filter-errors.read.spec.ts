import { expect, test } from '../fixtures/app'
import type { ApiRecorder } from '../fixtures/app'
import { OBJECT_LIST, openSearch, qOf, runSearch, searchInput } from './search'

/**
 * A filter the node would refuse, or read another way, gets a note and sends no request. "Sent
 * nothing" is proven by a request that MUST come after the note: a control search, awaited, and
 * only then the recorded list requests are checked. Locale-free: each note names the token as typed.
 */

const CONTROL = 'zzcontrol'

/** Every list request seen until the control search answered. */
async function listRequestsUntilControl(
  page: import('@playwright/test').Page,
  api: ApiRecorder
) {
  const control = page.waitForResponse(
    (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === CONTROL
  )
  await runSearch(page, CONTROL)
  await control
  return api.matching(OBJECT_LIST).map((r) => new URL(r.url).searchParams)
}

test.describe('17 - search / filters that cannot apply', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  for (const [token, param] of [
    ['mass:2', 'numKey'],
    ['temp>20°C', 'numUnit'],
    ['mass>2 t', 'numKey'],
    ['created:2026-02-30', 'createdFrom'],
    ['parent:abc', 'parent'],
  ] as const) {
    test(`SE4: ${token} gets a note on the list and sends no ${param}`, async ({
      page,
      api,
    }) => {
      await runSearch(page, token)
      await expect(page.getByTestId('search-filter-note')).toContainText(token)

      const sent = await listRequestsUntilControl(page, api)
      expect(sent.length).toBeGreaterThan(0)
      // The root list sends an empty `parent=`; only a value counts.
      expect(sent.filter((params) => params.get(param))).toEqual([])
    })
  }

  test('SE5: the search box marks a filter that cannot apply, before Enter', async ({
    page,
  }) => {
    await openSearch(page)
    await searchInput(page).fill('mass:2 deleted:yes')
    const problems = page.getByTestId('command-center-problems')
    await expect(problems).toContainText('mass:2')
    await expect(problems).toContainText('deleted:yes')
    await expect(searchInput(page)).toHaveAttribute(
      'aria-describedby',
      new RegExp(String(await problems.getAttribute('id')))
    )
  })

  test('SE6: nine words keep the dialog open with a hint, and send nothing', async ({
    page,
    api,
  }) => {
    const nine = 'one two three four five six seven eight nine'
    await runSearch(page, nine)
    await expect(searchInput(page)).toBeVisible()
    await expect(page.getByTestId('search-min-hint')).toBeVisible()
    await searchInput(page).press('Escape')

    const sent = await listRequestsUntilControl(page, api)
    expect(sent.filter((params) => params.get('q') === nine)).toEqual([])
  })

  test('SE7: a stray quote no longer turns the filters after it into text', async ({
    page,
    api,
  }) => {
    const answered = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === 'steel'
    )
    await runSearch(page, '"steel mass>2t')
    await answered
    const [params] = api
      .matching(OBJECT_LIST)
      .map((r) => new URL(r.url).searchParams)
      .filter((p) => p.get('q') === 'steel')
    expect(params.get('numKey')).toBe('mass')
    expect(params.get('numUnit')).toBe('t')
  })
})
