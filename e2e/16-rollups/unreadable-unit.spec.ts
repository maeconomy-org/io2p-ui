import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  saveSheetAndSettle,
  sheet,
} from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * `5 lux` — a unit in no dimension at all.
 *
 * Core parses it to nothing and counts it in `skippedCount`; folding it into the `unitless` bucket
 * would merge a pressure into a bare-number sum and produce a silently wrong total (fixed in core
 * as `24b209c`). Measured on the wire: the parent's entry goes to `skippedCount: 1` while its
 * bucket stays `num: 10, contributorCount: 1` — its own value, unchanged.
 *
 * NOT `bar`: core `6c5aed4` gave pressure a dimension, so `5 bar` is now a summable quantity and
 * this test asserted a world that no longer exists. The unit here has to be one the table genuinely
 * does not know, and the table is append-only — so when `lux` is eventually added, this breaks the
 * same way and wants the same fix rather than a longer timeout.
 *
 * Its own file rather than another case in `lifecycle.spec.ts`, because the assertion is that
 * NOTHING below contributes a number. In a serial file every earlier case that adds a value to the
 * child breaks that precondition, and the test then fails for a reason that has nothing to do with
 * units.
 */

const runId = Date.now()
const KEY = `lux${runId}`
const PARENT = `e2e-${runId}-lux-parent`
const CHILD = `e2e-${runId}-lux-child`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

test.describe('16 - rollups / an unreadable unit', () => {
  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    const row = page.getByTestId('data-table-row').filter({ hasText: KEY })
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    const actions = rowActions(page, 'rollup-rule', row)
    await actions.menu.click()
    await actions.action('delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^delete$/i })
      .click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
    await page.close()
  })

  test('RU12: an unreadable unit removes the contribution, it does not sum', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(720_000)

    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'rollupRulesCreate').click()
    await page.getByTestId('rollup-rule-property-key').fill(KEY)
    await page.getByTestId('rollup-rule-add-key').click()
    await page.getByTestId('rollup-rule-submit').click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: KEY })
    ).toHaveCount(1)

    // The child carries a READABLE value first, so the card exists to be taken away. Asserting an
    // absence against a card that was never there would pass for the wrong reason.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    for (const [name, parent] of [
      [PARENT, undefined],
      [CHILD, PARENT],
    ] as const) {
      const panel = await openCreateSheet(page)
      await panel.getByLabel(/name/i).first().fill(name)
      await addProperty(page, 0)
      await fillProperty(page, 0, KEY, '10 kg')
      if (parent) {
        await page.getByTestId('parent-picker').click()
        await page.getByTestId('parent-search').fill(parent)
        const option = page
          .locator('[data-testid^="parent-option-"]')
          .filter({ hasText: parent })
          .first()
        await expect(option).toBeVisible()
        await option.click()
        await page.keyboard.press('Escape')
      }
      await saveSheet(page)
      await expect(sheet(page)).toBeHidden()
    }

    const cardVisible = async () => {
      await page.goto('/objects')
      // `.first()`: an object sheet renders its OWN `data-table`, so a bare locator here is a
      // strict-mode violation whenever the previous iteration's sheet is still mounted — and
      // `Escape` closing it is not something to depend on.
      await expect(page.getByTestId('data-table').first()).toBeVisible()
      await openObjectSheet(page, rowFor(page, PARENT))
      await page.waitForTimeout(4_000)
      return (await page.getByTestId('rollup-card').count()) > 0
    }

    let appeared = false
    for (let attempt = 0; attempt < 8 && !appeared; attempt++) {
      appeared = await cardVisible()
      if (!appeared) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(25_000)
      }
    }
    expect(appeared, 'the card must exist before it can be taken away').toBe(
      true
    )
    await page.keyboard.press('Escape')

    // Now make the child's only value unreadable.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await openObjectSheet(page, rowFor(page, CHILD))
    await enterEditMode(page)
    await page.getByTestId('property-toggle-0').click()
    await page.getByTestId('property-value-0-0').fill('5 lux')
    await saveSheetAndSettle(page)

    // The skip is real and the reader never sees it: with nothing below contributing a number the
    // parent is the sole contributor again, so the whole card goes rather than gaining a badge.
    // A wider window than the first poll: this one runs LAST in the directory, after nineteen
    // other cases have queued work, and the ~70s settle on an idle node stretches under load.
    // Passing alone and failing in the run is contention, not a defect.
    let gone = false
    for (let attempt = 0; attempt < 14 && !gone; attempt++) {
      gone = !(await cardVisible())
      if (!gone) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(25_000)
      }
    }
    expect(gone, 'the card must go once nothing below contributes').toBe(true)
  })
})
