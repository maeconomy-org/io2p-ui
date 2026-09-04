import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * `.read.` means MUTATES NO SHARED STATE. A view preference is stored per account, so anything
 * that writes one is a `write` spec — hence L20 lives in `views.spec.ts`.
 */

test.describe('02 - objects list / chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    // A ROW, not the table: skeleton rows carry no testid, so the table is visible — and its header
    // buttons are clickable — while the page is still unhydrated. A click there is swallowed.
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
  })

  test('L1: the table renders rows and its pagination meta', async ({
    page,
  }) => {
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await expect(page.getByTestId('page-indicator')).toBeVisible()
  })

  test('L2: paging dims the rows rather than blanking them', async ({
    page,
  }) => {
    // NOT `test.skip(await next.isDisabled())`. `isDisabled()` does not retry, so it read the
    // button before it settled and the case SKIPPED on an account with 2230 objects across 112
    // pages — reporting as covered while never running. `toBeEnabled()` waits, so a genuinely
    // single-page account now FAILS here rather than quietly deleting the test.
    const next = page.getByTestId('page-next')
    await expect(next).toBeEnabled()

    const rows = page.getByTestId('data-table-row')
    const before = await rows.count()
    await next.click()

    await expect(rows.first()).toBeVisible()
    expect(before).toBeGreaterThan(0)
  })

  test('L6: the deleted filter reveals struck-through rows', async ({
    page,
  }) => {
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('filter-menu')).toHaveClass(/border-solid/)
  })

  test('L7: the access-scope filter changes the request the list makes', async ({
    page,
    api,
  }) => {
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-shared').click()
    await page.keyboard.press('Escape')

    await expect.poll(() => api.count(/scope=shared/)).toBeGreaterThan(0)
  })

  test('L9: Details opens the sheet; the row itself does not navigate', async ({
    page,
  }) => {
    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId('object-details-button').click()

    await expect(page.getByTestId('entity-sheet')).toBeVisible()
    await expect(page).toHaveURL(/\/objects$/)
  })

  test('L13/L14/L15: search floats over the table and clears', async ({
    page,
  }) => {
    const table = page.getByTestId('data-table')
    const before = await table.boundingBox()

    await tour(page, 'searchButton').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('combobox')
      .or(dialog.getByRole('textbox'))
      .first()
      .fill('e2e')
    await page.keyboard.press('Enter')

    const bar = page.getByTestId('search-results-bar')
    await expect(bar).toBeVisible()
    await expect(page.getByTestId('search-results-count')).toBeVisible()

    // Within a pixel: sub-pixel layout moves the box 129 -> 129.5, an inline bar would move it ~48.
    const after = await table.boundingBox()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2)

    await page.getByTestId('search-clear').click()
    await expect(bar).toBeHidden()
  })

  test('L17/L19: a row shows either a cover thumbnail or a placeholder, never a broken image', async ({
    page,
  }) => {
    const thumbs = page.getByTestId('cover-thumb')
    const placeholders = page.getByTestId('cover-placeholder')
    const rows = page.getByTestId('data-table-row')

    await expect(rows.first()).toBeVisible()
    const total = (await thumbs.count()) + (await placeholders.count())
    expect(total).toBe(await rows.count())
  })

  test('L4: sorting by name round-trips through the server', async ({
    page,
    api,
  }) => {
    await page
      .getByRole('button', { name: /^name$/i })
      .first()
      .click()
    await expect.poll(() => api.count(/[?&]sort=name/)).toBeGreaterThan(0)

    await page
      .getByRole('button', { name: /^name$/i })
      .first()
      .click()
    await expect.poll(() => api.count(/[?&]sort=-name/)).toBeGreaterThan(0)
  })

  test('L8: hover prefetches the detail, and opening it makes no second request', async ({
    page,
    api,
  }) => {
    // Anchored on the id: `/objects/<id>/rollups` is a different endpoint the sheet fetches on
    // open, and an unanchored pattern counts it as a second detail read.
    const detail = /\/objects\/[0-9a-f-]{8,}(\?|$)/i
    const row = page.getByTestId('data-table-row').first()

    await row.hover()
    await expect.poll(() => api.count(detail)).toBe(1)

    await row.getByTestId('object-details-button').click()
    await expect(page.getByTestId('entity-sheet')).toBeVisible()

    // The point of the prefetch is that the sheet opens populated. A second GET here means the
    // cache was warmed under a key the sheet does not read.
    await expect(page.getByTestId('sheet-edit')).toBeVisible()
    expect(api.count(detail)).toBe(1)
  })

  test('L21: a search that matches nothing renders the empty state, not a blank table', async ({
    page,
  }) => {
    await tour(page, 'searchButton').click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByRole('combobox')
      .or(dialog.getByRole('textbox'))
      .first()
      .fill('zzz-no-such-object-zzz')
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('data-table-row')).toHaveCount(0)
  })
})
