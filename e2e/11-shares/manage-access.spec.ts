import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { createObjectWithId, createProcess } from '../utils/process'
import { rowActions, tour } from '../utils/selectors'
import {
  addProperty,
  fillProperty,
  gotoList,
  openDialog,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * Share opens, and does something, on all FIVE shareable types.
 *
 * `1c533fa` is the case for this file. Manage access was gated to objects and processes because
 * `GET /v1/access` once refused the library types; core widened it and the gate outlived the
 * refusal — so for templates, formulas and constants the button rendered ENABLED and its handler
 * short-circuited to nothing. Sharing one of those became a one-way door, because Revoke all was
 * behind the same flag.
 *
 * That is the silent-fallback class again, and it is why every case asserts the sheet's own content
 * rather than that a dialog appeared. A short-circuiting handler renders no sheet at all, but so
 * does a click that missed; asserting `share-add-people` is the difference between "the sheet is
 * there" and "something opened".
 *
 * Each type is seeded rather than borrowed from the account. The share action is gated on
 * `canReshare(permission)` and `!isDeleted`, so a row that happens to be first in a library list —
 * a built-in, or someone else's shared item — legitimately offers no Share, and the case would fail
 * for a reason that has nothing to do with the gate.
 */

const runId = Date.now()
const NAMES = {
  object: `e2e-${runId}-ma-object`,
  process: `e2e-${runId}-ma-process`,
  template: `e2e-${runId}-ma-template`,
  formula: `e2e-${runId}-ma-formula`,
  constant: `e2e-${runId}-ma-constant`,
} as const

type ShareableType = keyof typeof NAMES

const PATHS: Record<ShareableType, string> = {
  object: '/objects',
  process: '/processes',
  template: '/templates',
  formula: '/formulas',
  constant: '/constants',
}

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

test.describe('11 - shares / manage access', () => {
  // NOT serial. The five cases are independent — five types, five pages, five rows, no shared
  // mutable state — and the `write` project is already one worker, so serial adds no isolation it
  // does not already have. Its only live effect would be skip propagation: one failure reporting
  // the other four as SKIPPED, which reads as coverage. That is exactly how RU23 sat unexecuted
  // while being counted.

  test.beforeAll(async ({ browser }, testInfo) => {
    // A hook carries its own 60s budget and `test.setTimeout` does not reach it. Five creates, one
    // of them a process needing its own object, is well past that on a cold node.
    testInfo.setTimeout(300_000)
    const page = await browser.newPage()

    // The object doubles as the process's input AND output — a process needs at least one of each,
    // and reusing one ref keeps this to a single extra create.
    await createObjectWithId(page, NAMES.object)
    await createProcess(page, NAMES.process, [NAMES.object], NAMES.object)

    await gotoList(page, '/templates')
    await tour(page, 'templatesCreate').click()
    await page.getByRole('menuitem', { name: /object/i }).click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByLabel(/name/i).first().fill(NAMES.template)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Material', 'concrete')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await gotoList(page, '/formulas')
    await tour(page, 'formulasCreate').click()
    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(NAMES.formula)
    await dialog.getByLabel(/expression/i).fill('x * 2')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()
    await expect(rowFor(page, NAMES.formula)).toHaveCount(1)

    await gotoList(page, '/constants')
    await tour(page, 'constantsCreate').click()
    await page.locator('#constant-name').fill(NAMES.constant)
    await page.locator('#constant-data').fill('0.42')
    await page
      .getByRole('button', { name: /create constant/i })
      .last()
      .click()
    await expect(rowFor(page, NAMES.constant)).toHaveCount(1)

    await page.close()
  })

  for (const type of Object.keys(NAMES) as ShareableType[]) {
    test(`S11: Manage access opens and works for a ${type}`, async ({
      page,
    }) => {
      await gotoList(page, PATHS[type])

      const row = rowFor(page, NAMES[type])
      await expect(row).toBeVisible()

      const actions = rowActions(page, type, row)
      await actions.menu.click()

      // Present AND enabled. The gate this pins left it rendering enabled, so its presence alone
      // was never the thing in question.
      const share = actions.action('share')
      await expect(share).toBeVisible()
      await share.click()

      // The sheet's own content, not merely a dialog. `ShareSheet` is a dynamic import, so it
      // arrives a beat after the click — and a handler that returns early leaves nothing behind at
      // all, which looks identical to a click that missed.
      await expect(page.getByTestId('share-add-people')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByTestId('share-sheet-save')).toBeVisible()
    })
  }
})
