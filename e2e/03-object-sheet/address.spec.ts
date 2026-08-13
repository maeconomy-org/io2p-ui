import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  enterEditMode,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  switchTab,
} from '../utils/sheet'

/**
 * The geocoder is a third party behind `/api/address`, so every case here serves it from a route.
 * That is not a shortcut: A5 is specifically "the lookup is unavailable and the address still
 * applies", which cannot be arranged against a working HERE key.
 */

const SUGGESTIONS = [
  {
    id: 'here:af:street:one',
    title: 'Stadhuisplein 1, Amersfoort',
    address: {
      label: 'Stadhuisplein 1, 3811 LM Amersfoort, Nederland',
      street: 'Stadhuisplein',
      houseNumber: '1',
      postalCode: '3811 LM',
      city: 'Amersfoort',
      state: 'Utrecht',
      countryCode: 'NLD',
      countryName: 'Nederland',
    },
  },
  {
    id: 'here:af:street:two',
    title: 'Havenstraat 22, Rotterdam',
    address: {
      label: 'Havenstraat 22, 3024 SG Rotterdam, Nederland',
      street: 'Havenstraat',
      houseNumber: '22',
      postalCode: '3024 SG',
      city: 'Rotterdam',
      state: 'Zuid-Holland',
      countryCode: 'NLD',
      countryName: 'Nederland',
    },
  },
]

interface GeocoderOptions {
  /** Reply to `?id=` with a 500 — the outage A5 is about. */
  lookupFails?: boolean
  /** Milliseconds to hold each `?id=` lookup, so A6 can overtake one. */
  lookupDelayMs?: number
  /** Return an empty suggestion list — a query the geocoder simply does not know. */
  noSuggestions?: boolean
}

async function serveGeocoder(
  page: Page,
  options: GeocoderOptions = {}
): Promise<void> {
  await page.route(/\/api\/address\?/, async (route) => {
    const url = new URL(route.request().url())
    const id = url.searchParams.get('id')
    if (!id) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: options.noSuggestions ? [] : SUGGESTIONS,
        }),
      })
    }
    if (options.lookupDelayMs) {
      await new Promise((done) => setTimeout(done, options.lookupDelayMs))
    }
    if (options.lookupFails) {
      return route.fulfill({ status: 500, body: 'geocoder down' })
    }
    const position =
      id === SUGGESTIONS[1]!.id
        ? { lat: 51.92442, lng: 4.47775 }
        : { lat: 52.15517, lng: 5.3873 }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ position }),
    })
  })
}

const stamp = () => `e2e-${Date.now()}`

/** Create an object carrying the first suggestion's address, and return its name. */
async function createWithAddress(page: Page): Promise<string> {
  const name = `${stamp()}-addr`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await page.getByTestId('address-input').fill('stadhuis')
  await page.getByTestId('address-suggestion-0').click()
  await saveSheet(page)
  return name
}

test.describe('03 - object sheet / address', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('A1: one request per debounced pause, not one per keystroke', async ({
    page,
    api,
  }) => {
    await serveGeocoder(page)
    await openCreateSheet(page)

    const input = page.getByTestId('address-input')
    api.clear()
    // `pressSequentially` types character by character, which is what a debounce has to survive.
    await input.pressSequentially('stadhuisplein', { delay: 20 })
    await expect(page.getByTestId('address-suggestion-0')).toBeVisible()

    expect(api.count(/\/api\/address\?q=/)).toBe(1)
  })

  test('A2: picking a suggestion looks it up once, by id, and searches no more', async ({
    page,
    api,
  }) => {
    await serveGeocoder(page)
    await openCreateSheet(page)

    await page.getByTestId('address-input').fill('stadhuis')
    await expect(page.getByTestId('address-suggestion-0')).toBeVisible()
    api.clear()
    await page.getByTestId('address-suggestion-0').click()

    await expect.poll(() => api.count(/\/api\/address\?id=/)).toBe(1)
    // The resolved label lands back in the input; searching for it again would be a wasted round
    // trip for an address that was just resolved.
    await expect
      .poll(() => api.count(/\/api\/address\?q=/), { timeout: 2_000 })
      .toBe(0)
  })

  test('A3/A4: the stored address reads back in parts, and the country follows the UI language', async ({
    page,
  }) => {
    await serveGeocoder(page)
    const name = await createWithAddress(page)

    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: name })
      .first()
    await openObjectSheet(page, row)
    await switchTab(page, 'details')

    await expect(page.getByTestId('address-full')).toContainText(
      'Stadhuisplein 1'
    )
    await expect(page.getByTestId('address-part-city')).toHaveText('Amersfoort')
    // Absence is not emptiness: without this row there is no way to tell a geocoded address from
    // one whose lookup silently failed.
    await expect(page.getByTestId('address-part-coordinates')).toContainText(
      '52.15517'
    )
    // Stored as an ISO code and rendered through `countryLabel`, so it reads as a name.
    await expect(page.getByTestId('address-part-country')).toHaveText(
      'Netherlands'
    )
  })

  test('A5: a geocoder outage still applies the address, without coordinates', async ({
    page,
    consoleGuard,
  }) => {
    // The 500 is the point of the test; the guard must still fail on anything else.
    consoleGuard.expectError(/500|Internal Server Error/)
    await serveGeocoder(page, { lookupFails: true })

    const name = await createWithAddress(page)
    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: name })
      .first()
    await openObjectSheet(page, row)
    await switchTab(page, 'details')

    await expect(page.getByTestId('address-full')).toContainText(
      'Stadhuisplein 1'
    )
    await expect(page.getByTestId('address-part-city')).toHaveText('Amersfoort')
    await expect(page.getByTestId('address-part-coordinates')).toHaveCount(0)
  })

  test('A6: a second pick beats a slower first lookup', async ({ page }) => {
    await serveGeocoder(page, { lookupDelayMs: 1_500 })
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(`${stamp()}-race`)

    await page.getByTestId('address-input').fill('stadhuis')
    await page.getByTestId('address-suggestion-0').click()
    await page.getByTestId('address-input').fill('haven')
    await page.getByTestId('address-suggestion-1').click()

    // The first lookup answers last. `lookupSeq` is what stops it overwriting the second pick.
    await page.waitForTimeout(3_000)
    await expect(page.getByTestId('address-input')).toHaveValue(
      /Havenstraat 22/
    )
  })

  test('A5b: the address field is a single input while editing, and parts only on read', async ({
    page,
  }) => {
    await serveGeocoder(page)
    const name = await createWithAddress(page)
    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: name })
      .first()
    await openObjectSheet(page, row)
    await switchTab(page, 'details')

    await expect(page.getByTestId('address-part-city')).toBeVisible()
    await enterEditMode(page)

    // Editing offers ONE field: the autocomplete resolves the parts, so asking for them by hand
    // would be worse.
    await expect(page.getByTestId('address-input')).toBeVisible()
    await expect(page.getByTestId('address-part-city')).toHaveCount(0)
  })

  test('A7: a query the geocoder does not know says so, in the app language', async ({
    page,
  }) => {
    // This message was HARDCODED ENGLISH (plan bug #8) — it read "No addresses found" under a
    // Dutch UI. The parity unit test pins the translation exists; only this pins that the
    // component reaches for it rather than carrying its own string.
    await serveGeocoder(page, { noSuggestions: true })
    await openCreateSheet(page)
    await page.getByTestId('address-input').fill('XYZ123NonExistentPlace999')

    // The QUERY, not the English wording: asserting the sentence would pass just as happily
    // against a hardcoded literal, which is the bug itself. Interpolation is the proof it went
    // through `t()`.
    const empty = page.getByTestId('address-no-results')
    await expect(empty).toBeVisible()
    await expect(empty).toContainText('XYZ123NonExistentPlace999')
  })
})
