import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'
import { openCreateSheet, saveSheet, sheet } from '../utils/sheet'

/** Selection, the actions it unlocks, and the two floating bars that can occupy the same corner. */

const runId = Date.now()
const NAMES = [`e2e-${runId}-b1`, `e2e-${runId}-b2`]

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function selectRows(page: Page, names: string[]) {
  for (const name of names) {
    await rowFor(page, name).getByRole('checkbox').check()
  }
}

test.describe('02 - objects list / selection', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    for (const name of NAMES) {
      const panel = await openCreateSheet(page)
      await panel.getByLabel(/name/i).first().fill(name)
      await saveSheet(page)
      await expect(sheet(page)).toBeHidden()
    }

    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('L10: the bulk bar counts what is selected', async ({ page }) => {
    await selectRows(page, NAMES)

    const bar = page.getByTestId('bulk-bar')
    await expect(bar).toBeVisible()
    // The count is of the SELECTION, not of the page: a previous version summed a per-page total
    // and read "20 of 25" for two ticked boxes.
    await expect(page.getByTestId('bulk-count')).toContainText('2')

    await page.getByTestId('bulk-clear').click()
    await expect(bar).toBeHidden()
  })

  test('L12: bulk Share opens the editor seeded with the selection', async ({
    page,
  }) => {
    await selectRows(page, NAMES)
    await page.getByTestId('bulk-share').click()

    // Bundling a selection IS what a share is, so the editor opens holding both — starting empty
    // would make the user re-find the objects they had just ticked.
    await expect(page.getByTestId('share-name')).toBeVisible()
    await expect(page.locator('[data-testid^="share-resource-"]')).toHaveCount(
      2
    )

    await page.getByTestId('share-cancel').click()
  })

  test('L16: the search bar and the selection bar stack instead of overlapping', async ({
    page,
  }) => {
    await tour(page, 'searchButton').click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByRole('combobox')
      .or(dialog.getByRole('textbox'))
      .first()
      .fill(`e2e-${runId}`)
    await page.keyboard.press('Enter')

    const searchBar = page.getByTestId('search-results-bar')
    await expect(searchBar).toBeVisible()

    await selectRows(page, [NAMES[0]])
    const bulkBar = page.getByTestId('bulk-bar')
    await expect(bulkBar).toBeVisible()

    const search = await searchBar.boundingBox()
    const bulk = await bulkBar.boundingBox()
    // Both are fixed to the same corner and are raised by level, so the failure is one sitting on
    // top of the other with its text unreadable.
    expect(search).not.toBeNull()
    expect(bulk).not.toBeNull()
    const gap =
      Math.max(search!.y, bulk!.y) -
      Math.min(search!.y + search!.height, bulk!.y + bulk!.height)
    expect(gap).toBeGreaterThanOrEqual(0)
  })

  test('L11: bulk delete soft-deletes, and the selection restores them', async ({
    page,
  }) => {
    await selectRows(page, NAMES)
    await page.getByTestId('bulk-delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()

    for (const name of NAMES) {
      await expect(rowFor(page, name)).toHaveCount(0)
    }

    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')

    for (const name of NAMES) {
      await expect(rowFor(page, name)).toBeVisible()
    }

    await selectRows(page, NAMES)
    await page.getByTestId('bulk-restore').click()

    // Restored rows come back to the DEFAULT list, so the round trip is only proved once the
    // deleted filter is off again.
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-clear').click()
    await page.keyboard.press('Escape')

    for (const name of NAMES) {
      await expect(rowFor(page, name)).toBeVisible()
    }
  })
})

test.describe('02 - objects list / page size', () => {
  /** A page size is account state, so whatever this run found is what it must leave behind. */
  let original = ''

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    // The pagination block is rendered from the RESPONSE, so it does not exist while the table is
    // still showing skeletons — and `count()` does not retry.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    if (!original) return
    await page.getByTestId('page-size').click()
    await page.getByRole('option', { name: original, exact: true }).click()
  })

  test('L3: changing the page size returns to page 1', async ({ page }) => {
    // `TablePagination` renders nothing at all on a single page, so there is no control to drive.
    // Asserted rather than skipped on: `count()` does not retry, so a read before the table
    // settles reports 0 and the case deletes itself while reporting as covered — which is exactly
    // what L2 was doing against an account of 2230 objects.
    const sizeTrigger = page.getByTestId('page-size')
    await expect(sizeTrigger).toBeVisible()

    original = (await sizeTrigger.innerText()).trim()
    const target = original === '10' ? '20' : '10'

    await page.getByTestId('page-next').click()
    await expect(page.getByTestId('page-number-2')).toHaveAttribute(
      'aria-current',
      'page'
    )

    await sizeTrigger.click()
    await page.getByRole('option', { name: target, exact: true }).click()

    // Page 2 of 20-per-page is not page 2 of 10-per-page. Keeping the number would silently show
    // rows from a different part of the list than the ones the user was reading.
    await expect(page.getByTestId('page-number-1')).toHaveAttribute(
      'aria-current',
      'page'
    )
  })
})
