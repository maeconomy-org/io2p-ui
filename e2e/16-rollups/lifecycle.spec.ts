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
 * The mutation cases, where the fragility is. Rollups are not properties — they arrive from a
 * second request, are computed by a background worker, and every number here settles ~70s after
 * the write that changed it (a 30s cooldown, then a reaper scanning every 30s).
 *
 * So nothing below compares arithmetic across a write. Each case asserts a STATE TRANSITION and
 * polls for it, which is the only thing the contract actually promises: a read straight after a
 * write may return the old totals, still marked `stale: false`.
 */

const runId = Date.now()
const KEY = `mass${runId}`
const PARENT = `e2e-${runId}-lc-parent`
const CHILD = `e2e-${runId}-lc-child`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** Every rule this file creates, so `afterAll` can remove them all — each one is a running cost. */
const createdRules: string[] = []

async function createRule(page: Page, key: string) {
  createdRules.push(key)
  await page.goto('/rollup-rules')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'rollupRulesCreate').click()
  await page.getByTestId('rollup-rule-property-key').fill(key)
  await page.getByTestId('rollup-rule-add-key').click()
  await page.getByTestId('rollup-rule-submit').click()
  await expect(
    page.getByTestId('data-table-row').filter({ hasText: key })
  ).toHaveCount(1)
}

async function createObject(
  page: Page,
  name: string,
  value: string,
  parentName?: string
) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, KEY, value)

  if (parentName) {
    await page.getByTestId('parent-picker').click()
    await page.getByTestId('parent-search').fill(parentName)
    const option = page
      .locator('[data-testid^="parent-option-"]')
      .filter({ hasText: parentName })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await page.keyboard.press('Escape')
  }

  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

/** Open the parent's sheet and poll until `predicate` holds, or give up after ~3 minutes. */
async function pollParent(
  page: Page,
  predicate: (page: Page) => Promise<boolean>,
  what: string
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))
    await page.waitForTimeout(4_000)
    if (await predicate(page)) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(25_000)
  }
  throw new Error(`the parent never reached: ${what}`)
}

const hasCard = async (page: Page) =>
  (await page.getByTestId('rollup-card').count()) > 0

test.describe('16 - rollups / lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    for (const key of createdRules) {
      const row = page.getByTestId('data-table-row').filter({ hasText: key })
      // `toHaveCount` WAITS; a bare `count()` reads before the list has fetched and skips the
      // cleanup silently, which is how thirteen rules leaked into the dev node.
      await expect(row).toHaveCount(1, { timeout: 15_000 })
      const actions = rowActions(page, 'rollup-rule', row)
      await actions.menu.click()
      await actions.action('delete').click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^delete$/i })
        .click()
      await expect(row).toHaveCount(0, { timeout: 15_000 })
    }
    await page.close()
  })

  test('RU9: a rule added after the objects computes on its own', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await createObject(page, PARENT, '10 kg')
    await createObject(page, CHILD, '10 kg', PARENT)

    await createRule(page, KEY)

    // The defect this file was written around: a rule used to arm nothing, so a rule created
    // after the last write to a subtree computed NEVER and the card stayed absent forever.
    // Creating the rule now arms every holder of its key, with no further write to the data.
    //
    // Slow on purpose. Storm control is per TARGET: an entity computed inside the cooldown is
    // deferred whatever rule arrives next, and the reaper re-drives on its own tick — so a rule
    // over a subtree written moments ago (as here) can take ~60s, where the same rule over quiet
    // data lands in under a second.
    await pollParent(
      page,
      hasCard,
      'a card from the rule alone, with no further write'
    )
  })

  test('RU10: a write to the subtree moves the total', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    // RU9 already left a card on the parent, so asserting one EXISTS here could no longer fail.
    // What this case owns is the other half of convergence: a rule arms once, but a write to the
    // subtree has to re-arm it. So read the line first and require it to move.
    //
    // The reading is compared to itself rather than to a number: the file's rule is that nothing
    // compares arithmetic across a write, because a read straight after one may still return the
    // old totals marked `stale: false`.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))
    const before = ((await page.getByTestId('rollup-line').textContent()) ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    await page.keyboard.press('Escape')

    // Touch the child, which is what arms the recompute for its whole ancestor chain.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await openObjectSheet(page, rowFor(page, CHILD))
    await enterEditMode(page)
    await page.getByTestId('property-toggle-0').click()
    await page.getByTestId('property-value-0-0').fill('12 kg')
    await saveSheetAndSettle(page)

    const lineMoved = async (p: Page) => {
      const now = ((await p.getByTestId('rollup-line').textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      return now !== '' && now !== before
    }
    await pollParent(page, lineMoved, 'a total that moved after the write')
  })

  test('RU4: an orphan key renders a card the parent never authored', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    // The parent holds NO property under this key; only the child does. Core calls this the most
    // valuable case — the total exists precisely because a reader cannot see it any other way —
    // and an implementation that decorates existing property rows drops it entirely.
    const orphanKey = `orph${Date.now()}`
    await createRule(page, orphanKey)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await openObjectSheet(page, rowFor(page, CHILD))
    await enterEditMode(page)
    const next = await addProperty(page, 1)
    await fillProperty(page, next, orphanKey, '7 kg')
    await saveSheetAndSettle(page)

    await pollParent(
      page,
      async (p) =>
        (await p
          .getByTestId('rollup-card')
          .filter({ hasText: orphanKey })
          .count()) > 0,
      'a card for a key the parent never authored'
    )
  })

  test('RU14: two units in one dimension total as one bucket', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    // The normalizer converts at WRITE time — `2 t` is stored as `num: 2000, unit: kg` — so both
    // values are already in the canonical unit by the time the rollup buckets them, and the
    // compute never re-parses a display string. Two units, one dimension, one total.
    const key = `mix${Date.now()}`
    await createRule(page, key)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await openObjectSheet(page, rowFor(page, CHILD))
    await enterEditMode(page)
    // Slot 2, not 1: this describe is serial and RU4 above already appended one, so the index is
    // the count of rows the CHILD now has rather than a constant.
    const slot = await addProperty(page, 2)
    await fillProperty(page, slot, key, '2 t')
    await saveSheetAndSettle(page)

    // The parent authored nothing under this key, so the card is an orphan and everything in it
    // came from below. One bucket: a second would mean the tonnes were treated as their own
    // dimension, which is the silent-wrong-number shape this whole feature exists to avoid.
    await pollParent(
      page,
      async (p) =>
        (await p.getByTestId('rollup-card').filter({ hasText: key }).count()) >
        0,
      'a card totalling the tonnes the child authored'
    )
    await expect(
      page.getByTestId('rollup-card').filter({ hasText: key })
    ).not.toContainText(/more unit/i)
  })
})
