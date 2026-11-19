import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { gotoList } from '../utils/sheet'
import {
  createObject,
  deleteObjects,
  nodeCall,
  OBJECT_LIST,
  openSearch,
  property,
  qOf,
  searchInput,
} from '../utils/search'

/**
 * Each filter, typed and from the Add filter panel, gives the same pills, the same request and the
 * same rows. The run stamp is in every query, so only this run's objects can answer.
 */

const STAMP = String(Date.now())
const created: string[] = []
let folderId = ''
let myId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await gotoList(page, '/objects')
  folderId = await createObject(page, { name: `QA-e2e-${STAMP} folder` })
  created.push(folderId)
  created.push(
    await createObject(page, {
      name: `QA-e2e-${STAMP} heavy`,
      parents: [folderId],
      properties: [property('mass', '3 t'), property('colour', 'red')],
    } as never),
    await createObject(page, {
      name: `QA-e2e-${STAMP} light`,
      properties: [property('mass', '1 t'), property('colour', 'blue')],
    })
  )
  // Deleted on purpose and left deleted: the one row `deleted:true` must find.
  const gone = await createObject(page, { name: `QA-e2e-${STAMP} gone` })
  await deleteObjects(page, [gone])
  myId = (await nodeCall<{ id: string }>(page, 'GET', '/me')).id
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await gotoList(page, '/objects')
  await deleteObjects(page, [...created].reverse())
  await page.close()
})

/** The pill texts, read through each remove button's accessible name parts. */
const pillTexts = (page: Page) =>
  page
    .locator('button[aria-labelledby*="-remove "]')
    .evaluateAll((buttons) =>
      buttons.map(
        (b) =>
          document.getElementById(
            b.getAttribute('aria-labelledby')!.split(' ')[1]
          )?.textContent ?? ''
      )
    )

/** Runs the search in the box now, and gives back its request and this run's rows. */
async function searchAndRead(page: Page) {
  const answered = page.waitForResponse(
    (r) => OBJECT_LIST.test(r.url()) && (qOf(r.url()) ?? '').includes(STAMP)
  )
  const pills = await pillTexts(page)
  await searchInput(page).press('Enter')
  const response = await answered
  const params = new URL(response.url()).searchParams
  params.delete('page')
  await expect(page.getByTestId('data-table')).toBeVisible()
  const rows = (await page.getByTestId('data-table-row').allInnerTexts())
    .map((text) => new RegExp(`QA-e2e-${STAMP} (\\w+)`).exec(text)?.[1])
    .filter((name): name is string => name !== undefined)
    .sort()
  return { pills, params: params.toString(), rows }
}

async function typed(page: Page, query: string) {
  await openSearch(page)
  await searchInput(page).fill(query)
  return searchAndRead(page)
}

async function fromPanel(page: Page, fill: (panel: Page) => Promise<void>) {
  // A fresh load: the same search would otherwise come from the cache and send no request.
  await gotoList(page, new URL(page.url()).pathname)
  await openSearch(page)
  await searchInput(page).fill(STAMP)
  await page.getByTestId('add-filter').click()
  await fill(page)
  await page
    .getByTestId('filter-panel')
    .locator('button[type="submit"]')
    .click()
  return searchAndRead(page)
}

const field = (page: Page, name: string) =>
  page.getByTestId('filter-panel').locator(`[data-field="${name}"]`)

test.describe('17 - search / filters, typed and from the panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoList(page, '/objects')
  })

  test('SF4: a number with a unit, scoped by the run word', async ({
    page,
  }) => {
    const a = await typed(page, `${STAMP} mass>=2t`)
    const b = await fromPanel(page, async () => {
      await field(page, 'numberKey').fill('mass')
      await field(page, 'numberFrom').fill('2')
      await field(page, 'numberUnit').fill('t')
    })
    expect(b).toEqual(a)
    expect(a.rows).toEqual(['heavy'])
  })

  test('SF5: a property with a value', async ({ page }) => {
    const a = await typed(page, `${STAMP} prop:colour=red`)
    const b = await fromPanel(page, async () => {
      await field(page, 'propertyKey').fill('colour')
      await field(page, 'propertyValue').fill('red')
    })
    expect(b).toEqual(a)
    expect(a.rows).toEqual(['heavy'])
  })

  test('SF6: inside a folder', async ({ page }) => {
    const a = await typed(page, `${STAMP} in:${folderId}`)
    const b = await fromPanel(page, async () => {
      await page
        .getByTestId('filter-panel')
        .locator('[aria-labelledby$="-folder-label"]')
        .click()
      await page.getByTestId('object-picker-search').fill(`${STAMP} folder`)
      await page
        .getByRole('option')
        .filter({ hasText: `QA-e2e-${STAMP} folder` })
        .click()
    })
    expect(b.params).toEqual(a.params)
    expect(b.rows).toEqual(a.rows)
    expect(a.rows).toEqual(['heavy'])
  })

  test('SF8: a created date range', async ({ page }) => {
    const a = await typed(page, `${STAMP} created:2020-01-01..2099-12-31`)
    const b = await fromPanel(page, async () => {
      await field(page, 'createdFrom').fill('2020-01-01')
      await field(page, 'createdTo').fill('2099-12-31')
    })
    expect(b).toEqual(a)
    expect(a.rows).toEqual(['folder', 'heavy', 'light'])
  })

  test('SF9: deleted rows only', async ({ page }) => {
    const a = await typed(page, `${STAMP} deleted:true`)
    const b = await fromPanel(page, async () => {
      await page
        .getByTestId('filter-panel')
        .locator('select')
        .selectOption('true')
    })
    expect(b).toEqual(a)
    expect(a.rows).toEqual(['gone'])
  })

  test('SF10: created by a person', async ({ page }) => {
    const a = await typed(page, `${STAMP} createdBy:${myId}`)
    const b = await fromPanel(page, async () => {
      await page
        .getByTestId('filter-panel')
        .locator('[aria-labelledby$="-createdBy-label"]')
        .click()
      await page.locator(`[cmdk-item][data-value="${myId}"]`).click()
    })
    expect(b.params).toEqual(a.params)
    expect(b.rows).toEqual(a.rows)
    expect(a.rows).toEqual(['folder', 'heavy', 'light'])
  })

  test('SF7: a number filter on /processes is left out, with a note', async ({
    page,
  }) => {
    // Processes store no searchable numbers, so the list says it did not apply the filter.
    await gotoList(page, '/processes')
    await openSearch(page)
    await searchInput(page).fill(`${STAMP} mass>=2t`)
    await searchInput(page).press('Enter')
    await expect(page.getByTestId('search-filter-note')).toContainText(
      'mass>=2t'
    )
  })
})
