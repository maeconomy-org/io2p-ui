import { expect, test } from '../fixtures/app'
import { gotoList } from '../utils/sheet'
import {
  OBJECT_LIST,
  openSearch,
  qOf,
  runSearch,
  searchInput,
} from '../utils/search'

/**
 * The search dialog's helpers: filter suggestions, recent searches, the "view deleted" action, and
 * a picker that sends only the last of fast keystrokes. Recent searches live in this browser
 * context's localStorage, so nothing here outlives the test.
 */

test.describe('17 - search / the search dialog', () => {
  test.beforeEach(async ({ page }) => {
    await gotoList(page, '/objects')
  })

  test('SE9: a partial filter name offers the filter, and picking it completes the token', async ({
    page,
  }) => {
    await openSearch(page)
    await searchInput(page).fill('beton dele')
    await page.getByTestId('search-suggestion-deleted').click()
    await expect(searchInput(page)).toHaveValue('beton deleted:')
    await expect(searchInput(page)).toBeFocused()
  })

  test('SE10: a search that ran is offered again, and picking it fills the box', async ({
    page,
  }) => {
    const query = `zzrecent${Date.now()}`
    await runSearch(page, query)
    await expect(searchInput(page)).toHaveCount(0)

    // The dialog reopens holding the active search; recents show for an empty box.
    await openSearch(page)
    await expect(searchInput(page)).toHaveValue(query)
    await page.getByTestId('command-center-clear').click()
    const recent = page.getByTestId('recent-search').filter({ hasText: query })
    await expect(recent).toHaveCount(1)
    await recent.click()
    await expect(searchInput(page)).toHaveValue(query)
  })

  test('SE11: "view deleted" asks the node for deleted rows only', async ({
    page,
  }) => {
    await openSearch(page)
    await page.getByTestId('quick-view-deleted').click()
    await expect(searchInput(page)).toHaveValue('deleted:true ')
    const answered = page.waitForResponse(
      (r) =>
        OBJECT_LIST.test(r.url()) &&
        new URL(r.url()).searchParams.get('deleted') === 'only'
    )
    await searchInput(page).press('Enter')
    await answered
  })

  test('SE12: fast typing in a picker sends only the last text', async ({
    page,
    api,
  }) => {
    const text = `zzfast${Date.now()}`
    await openSearch(page)
    await page.getByTestId('add-filter').click()
    await page
      .getByTestId('filter-panel')
      .locator('[aria-labelledby$="-folder-label"]')
      .click()
    const last = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === text
    )
    await page.getByTestId('object-picker-search').pressSequentially(text)
    await last

    const sent = api
      .matching(OBJECT_LIST)
      .map((r) => qOf(r.url))
      .filter((q) => q?.startsWith('zzfast'))
    expect(sent).toEqual([text])
  })
})
