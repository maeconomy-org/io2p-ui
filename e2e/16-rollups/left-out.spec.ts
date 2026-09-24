import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { deleteRollupRulesByKey } from '../utils/rollup-rules'
import { bind, chooseFormula, createFormula } from '../utils/formulas'
import { siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  fillProperty,
  listTable,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * A formula value whose unit the node cannot check is stored and shown, but left out of every
 * total. `log(a)` over a mass, declared in kg, is one: the node cannot say what unit a logarithm
 * of kilograms has. The object's own row and the total above it must both say so, or the value
 * silently drops out of a sum the reader trusts.
 */

const runId = Date.now()
const KEY = `lo${runId}`
const FORMULA = `e2e-${runId}-log`
const PARENT = `e2e-${runId}-left-out-parent`
const CHILD = `e2e-${runId}-left-out-child`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** Reopen the parent until its card reports the left-out value, which the worker computes later. */
async function pollParent(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto('/objects')
    await expect(listTable(page)).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))
    await page.waitForTimeout(4_000)
    if ((await page.getByTestId('rollup-unverified').count()) > 0) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(25_000)
  }
  throw new Error(`${PARENT} never reported its left-out value`)
}

test.describe('16 - rollups / a left-out formula value', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(300_000)
    const page = await browser.newPage()

    await createFormula(page, FORMULA, 'log(a)', 'kg')

    // The parent holds the left-out value; the child gives the card a total to report beside it.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    let panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(PARENT)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Source', '1500 kg')
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill(KEY)
    await chooseFormula(page, 1, FORMULA)
    await bind(page, 'a', siblingTestId('Source'))
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(CHILD)
    await addProperty(page, 0)
    await fillProperty(page, 0, KEY, '2 kg')
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(PARENT)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: PARENT })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'rollupRulesCreate').click()
    await page.getByTestId('rollup-rule-property-key').fill(KEY)
    await page.getByTestId('rollup-rule-add-key').click()
    await page.getByTestId('rollup-rule-submit').click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: KEY })
    ).toHaveCount(1, { timeout: 15_000 })
    await page.close()
  })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    const failure = await deleteRollupRulesByKey(page, [KEY])
    await page.close()
    expect(failure, `rollup rule cleanup: ${failure}`).toBeNull()
  })

  test('RU28: the total and the value both say the value is left out', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)
    await pollParent(page)

    // Anchored: the card also prints the key, whose timestamp holds any digit.
    const card = page.getByTestId('rollup-card')
    await expect(card.getByTestId('rollup-line')).toContainText(/(^|\D)2 kg/)
    await expect(card.getByTestId('rollup-skipped')).toHaveText(
      /^1 not counted\b/
    )
    await expect(card.getByTestId('rollup-unverified')).toHaveText(
      /^\W*1 of them\b/
    )

    await page
      .getByRole('button', { name: new RegExp(KEY) })
      .first()
      .click()
    await expect(page.getByTestId('provenance-unit-left-out')).toBeVisible()
  })
})
