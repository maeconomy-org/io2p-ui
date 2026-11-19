import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { gotoList } from '../utils/sheet'
import {
  OBJECT_LIST,
  openSearch,
  qOf,
  searchInput,
  sweepSavedSearches,
} from '../utils/search'

/**
 * Saved searches on the main account. Saved searches are ACCOUNT state, so this suite's entries
 * (named `QA-e2e-…`) are swept one key at a time before and after, never as `{ search: {} }`.
 */

const PREFIX = 'QA-e2e-'
const STAMP = String(Date.now())
const NAME = `${PREFIX}${STAMP} steel`
const QUERY = `${STAMP} steel`
const PREFERENCES = /\/v1\/me\/preferences$/

async function sweep(browser: import('@playwright/test').Browser) {
  const page = await browser.newPage()
  await gotoList(page, '/objects')
  await sweepSavedSearches(page, PREFIX)
  await page.close()
}

test.describe.configure({ mode: 'serial' })
test.beforeAll(async ({ browser }) => sweep(browser))
test.afterAll(async ({ browser }) => sweep(browser))

const savedRow = (page: Page, name: string) =>
  page.getByTestId('saved-searches').getByRole('button', { name, exact: true })
const saveForm = (page: Page) => page.getByTestId('save-search-form')

async function openSaveRow(page: Page, query: string) {
  await openSearch(page)
  await searchInput(page).fill(query)
  await page.getByTestId('save-search').focus()
  await page.keyboard.press('Enter')
  await expect(saveForm(page)).toBeVisible()
}

test.describe('17 - search / saved searches', () => {
  test.beforeEach(async ({ page }) => {
    await gotoList(page, '/objects')
  })

  test('SS1: saves by keyboard, keeps it over a reload, and runs it', async ({
    page,
  }) => {
    await openSaveRow(page, QUERY)
    const name = saveForm(page).getByRole('textbox')
    await name.fill(NAME)
    const saved = page.waitForResponse(
      (r) => PREFERENCES.test(r.url()) && r.request().method() === 'PATCH'
    )
    await name.press('Enter')
    expect((await saved).ok()).toBe(true)

    await page.reload()
    await openSearch(page)
    await expect(savedRow(page, NAME)).toBeVisible()

    await savedRow(page, NAME).click()
    await expect(searchInput(page)).toHaveValue(QUERY)
    const ran = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === QUERY
    )
    await searchInput(page).press('Enter')
    await ran
  })

  test('SS2: the same search in other case is a duplicate, and sends nothing', async ({
    page,
    api,
  }) => {
    await openSaveRow(page, QUERY.toUpperCase())
    await saveForm(page).getByRole('textbox').fill(`${PREFIX}${STAMP} again`)
    api.clear()
    await saveForm(page).getByRole('textbox').press('Enter')
    await expect(saveForm(page).getByRole('alert')).toContainText(NAME)
    expect(api.count(PREFERENCES)).toBe(0)
  })

  test('SS3: a save with no answer says so, and saves nothing', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/ERR_INTERNET_DISCONNECTED|Failed to fetch/)
    await page.route(PREFERENCES, (route) =>
      route.request().method() === 'PATCH'
        ? route.abort('internetdisconnected')
        : route.continue()
    )
    await openSaveRow(page, `${STAMP} offline`)
    await saveForm(page).getByRole('textbox').fill(`${PREFIX}${STAMP} offline`)
    await saveForm(page).getByRole('textbox').press('Enter')
    // Longer than the client's network retry backoff, not a fixed wait.
    await expect(saveForm(page).getByRole('alert')).not.toBeEmpty({
      timeout: 20_000,
    })
    await page.unroute(PREFERENCES)

    await page.keyboard.press('Escape')
    await expect(savedRow(page, `${PREFIX}${STAMP} offline`)).toHaveCount(0)
  })

  test('SS4: Escape closes the save row first, then the dialog', async ({
    page,
  }) => {
    await openSaveRow(page, QUERY)
    await page.keyboard.press('Escape')
    await expect(saveForm(page)).toHaveCount(0)
    await expect(searchInput(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(searchInput(page)).toHaveCount(0)
  })

  test('SS5: the save row fits a 320 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await openSaveRow(page, QUERY)
    // The page behind the modal is scroll-locked, so only the dialog's own boxes count.
    const outside = await page.getByRole('dialog').evaluate((dialog) =>
      [dialog, ...Array.from(dialog.querySelectorAll('*'))]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.left < 0 || r.right > innerWidth))
        .map((r) => `${Math.round(r.left)}..${Math.round(r.right)}`)
    )
    expect(outside).toEqual([])
    await expect(saveForm(page).getByRole('button')).toBeInViewport()
  })

  test('SS6: deletes the saved search by its named button', async ({
    page,
  }) => {
    await openSearch(page)
    const removed = page.waitForResponse(
      (r) => PREFERENCES.test(r.url()) && r.request().method() === 'PATCH'
    )
    await page
      .getByTestId('saved-searches')
      .getByRole('button', { name: new RegExp(`: ${NAME}$`) })
      .click()
    expect((await removed).ok()).toBe(true)
    await expect(savedRow(page, NAME)).toHaveCount(0)
  })
})
