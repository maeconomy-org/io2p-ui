import { expect, test } from '../fixtures/app'
import { patchPreferences } from '../utils/preferences'
import { gotoList } from '../utils/sheet'
import {
  OBJECT_LIST,
  openSearch,
  qOf,
  searchInput,
  sweepSavedSearches,
} from './search'

/**
 * Search on the Dutch page: a comma decimal in a filter, its pill and note, and a saved search. The
 * language is ACCOUNT state: set through the API, and put back to English after every test.
 */

const STAMP = String(Date.now())
const PREFIX = 'QA-e2e-'
const PREFERENCES = /\/v1\/me\/preferences$/

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await gotoList(page, '/objects')
  await patchPreferences(page, { locale: { app: 'nl' } })
  await gotoList(page, '/objects')
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
})

test.afterEach(async ({ page }) => {
  await patchPreferences(page, { locale: { app: 'en' } })
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await gotoList(page, '/objects')
  await sweepSavedSearches(page, PREFIX)
  await page.close()
})

test.describe('17 - search / Dutch', () => {
  test('SD1: a comma decimal reads as a decimal, on the pill and in the request', async ({
    page,
  }) => {
    await openSearch(page)
    await searchInput(page).fill(`${STAMP} gewicht>1,5t`)
    await expect(
      page.locator('button[aria-labelledby*="-remove "]')
    ).toHaveCount(1)
    await expect(page.getByRole('dialog')).toContainText('gewicht≥1,5t')

    const answered = page.waitForResponse(
      (r) => OBJECT_LIST.test(r.url()) && qOf(r.url()) === STAMP
    )
    await searchInput(page).press('Enter')
    const params = new URL((await answered).url()).searchParams
    expect(params.get('numGte')).toBe('1.5')
    expect(params.get('numUnit')).toBe('t')
  })

  test('SD2: a filter that cannot apply is explained in Dutch', async ({
    page,
  }) => {
    await openSearch(page)
    await searchInput(page).fill('temp>20°C')
    await expect(page.getByTestId('command-center-problems')).toContainText(
      'Niet toegepast: temp>20°C. Deze eenheid is onbekend.'
    )
  })

  test('SD3: a search saves and says so in Dutch', async ({ page }) => {
    const name = `${PREFIX}${STAMP} nl`
    await openSearch(page)
    await searchInput(page).fill(`${STAMP} beton`)
    await page.getByTestId('save-search').click()
    const form = page.getByTestId('save-search-form')
    await form.getByRole('textbox').fill(name)
    const saved = page.waitForResponse(
      (r) => PREFERENCES.test(r.url()) && r.request().method() === 'PATCH'
    )
    await form.getByRole('textbox').press('Enter')
    expect((await saved).ok()).toBe(true)
    await expect(page.getByRole('dialog')).toContainText(
      `Opgeslagen als "${name}".`
    )
  })
})
