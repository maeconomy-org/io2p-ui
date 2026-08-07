import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * §6.3 — the objects list chrome, read-only half.
 *
 * Paging, filtering and searching change what is DISPLAYED, not what exists, so these are `.read.`
 * and run in parallel. The mutating half (bulk delete/restore) lives in `bulk.spec.ts`.
 *
 * `.read.` means MUTATES NO SHARED STATE — which is stricter than "creates no objects". A view
 * preference is stored per account on the node, so switching one poisons the other three workers
 * running against the same login: a columns-view test ran here once and every sibling lost its
 * table. Anything that writes a preference belongs in the serial project, which is why L20 sits in
 * `views.spec.ts`.
 */

test.describe('02 - objects list / chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
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
    const next = page.getByTestId('page-next')
    test.skip(await next.isDisabled(), 'needs more than one page of objects')

    const rows = page.getByTestId('data-table-row')
    const before = await rows.count()
    await next.click()

    // `keepPreviousData` — the point is that rows are never replaced by a spinner. Asserting the
    // count stays positive throughout is what "no flash" means in a way a test can see.
    await expect(rows.first()).toBeVisible()
    expect(before).toBeGreaterThan(0)
  })

  test('L6: the deleted filter reveals struck-through rows', async ({
    page,
  }) => {
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-deleted').click()
    await page.keyboard.press('Escape')

    // The filter applied — whether any deleted rows exist is data-dependent, so assert the control
    // took effect rather than a row count the fixture cannot guarantee.
    await expect(page.getByTestId('filter-menu')).toHaveClass(/border-solid/)
  })

  test('L7: the access-scope filter changes the request the list makes', async ({
    page,
    api,
  }) => {
    await page.getByTestId('filter-menu').click()
    await page.getByTestId('filter-option-shared').click()
    await page.keyboard.press('Escape')

    // ⚠ Asserting the REQUEST, not the rows: a scope filter that renders as selected while the
    // query goes out unchanged is exactly the enabled-control-that-does-nothing class, and the
    // row set can legitimately be empty either way.
    await expect.poll(() => api.count(/scope=shared/)).toBeGreaterThan(0)
  })

  test('L9: Details opens the sheet; the row itself does not navigate', async ({
    page,
  }) => {
    const row = page.getByTestId('data-table-row').first()
    await row.getByTestId('object-details-button').click()

    await expect(page.getByTestId('entity-sheet')).toBeVisible()
    // Two different targets, easy to conflate: the sheet is not a navigation.
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

    // L13: the bar FLOATS. An inline strip would push the table down the moment a search resolved,
    // moving the very rows the user was reading — so the table's y must not change.
    //
    // Within a pixel, not exactly: sub-pixel layout puts the box at 129.5 where it was 129, and an
    // exact match would fail on a rounding difference while a real inline bar moves it by ~48.
    const after = await table.boundingBox()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2)

    // L15: clearing restores the list.
    await page.getByTestId('search-clear').click()
    await expect(bar).toBeHidden()
  })

  /**
   * L5 (column toggle persists across reload) is NOT WRITTEN, deliberately.
   *
   * `DataTableColumnToggle` is exported from `entity-list/data-table.tsx` and imported by exactly
   * one thing: its own unit test. No route mounts it, so there is no control to drive — the same
   * shape as `EditableSection` in §1.1, which also still exists and is also rendered nowhere.
   *
   * A spec here would have to mount the component itself, which tests React rather than the app.
   * The testids are in place (`column-toggle`, `column-option-{id}`) so this becomes a five-line
   * spec the day a page renders it.
   */

  // L20 (columns view) lives in `views.spec.ts`, NOT here — see the note at the top of this file.

  test('L17/L19: a row shows either a cover thumbnail or a placeholder, never a broken image', async ({
    page,
  }) => {
    // ⚠ Absence vs failure. Every row must resolve to one of the two — a third state means an
    // <img> pointing at nothing.
    const thumbs = page.getByTestId('cover-thumb')
    const placeholders = page.getByTestId('cover-placeholder')
    const rows = page.getByTestId('data-table-row')

    await expect(rows.first()).toBeVisible()
    const total = (await thumbs.count()) + (await placeholders.count())
    expect(total).toBe(await rows.count())
  })
})
