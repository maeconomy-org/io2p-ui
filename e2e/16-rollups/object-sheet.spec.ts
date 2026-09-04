import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addProperty,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * Rollups render as read-only PROPERTIES in the object sheet, and that surface had no e2e at all —
 * the implementation plan says it was "never rendered in a browser", verified by types and unit
 * tests only. `6842843` then fixed a card claiming a leaf had descendants, found by reading code.
 *
 * A card needs FOUR things to appear, which is why these tests build their own fixture: a live rule
 * for the key, an object the viewer OWNS, a numeric bucket, and something below actually
 * contributing. Miss the last and the sole-contributor filter correctly drops the card.
 *
 * The rule is created here rather than assumed from seeds: the seeder is `$setOnInsert`, so a dev
 * DB holding older rules never updates them.
 */

const runId = Date.now()
const KEY = `mass${runId}`
const PARENT = `e2e-${runId}-rollup-parent`
const CHILD = `e2e-${runId}-rollup-child`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

async function createObject(page: Page, name: string, parentName?: string) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  await addProperty(page, 0)
  await fillProperty(page, 0, KEY, '10 kg')

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

/**
 * Poll the parent's sheet until the child's value is folded into the total.
 *
 * `stale: false` alone does NOT mean current — the published contract says a read straight after a
 * write may return the old totals still marked fresh, because the trigger fires just after commit.
 * The card itself is the signal: it appears only once something below actually contributes.
 */
async function waitForSubtreeTotal(page: Page): Promise<void> {
  // A plain loop, not `toPass`: the retry wrapper swallows the real error on every attempt, and
  // what is being waited on here is a background worker, not a flaky assertion.
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))
    await page.waitForTimeout(4_000)
    if ((await page.getByTestId('rollup-card').count()) > 0) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(25_000)
  }
  throw new Error(
    'the parent total never picked up the child — see the ~70s settle measured in §6.17'
  )
}

test.describe('16 - rollups / object sheet', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    // A HOOK has its own 60s budget that `test.setTimeout` does not touch. Settling the parent's
    // total takes ~70s on the node's defaults (a 30s cooldown, then a reaper scanning every 30s),
    // so without this the fixture dies before the worker has run once — and the symptom is an
    // absent card, which reads as a product bug rather than as a hook that ran out of time.
    testInfo.setTimeout(240_000)
    const page = await browser.newPage()

    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'rollupRulesCreate').click()
    await page.getByTestId('rollup-rule-property-key').fill(KEY)
    await page.getByTestId('rollup-rule-add-key').click()
    await page.getByTestId('rollup-rule-submit').click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: KEY })
    ).toHaveCount(1)

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await createObject(page, PARENT)
    await createObject(page, CHILD, PARENT)

    // The child is not in the parent's total yet. `ROLLUP_COOLDOWN_MS` defaults to 30s and the
    // reaper re-drives on its own 30s scan, so the wait is up to ~90s — measured at 45s here.
    // Until it lands the parent is its OWN sole contributor and the card is CORRECTLY suppressed,
    // which reads exactly like a broken fixture. Settle it once, in setup, so the cases below
    // assert on rendering rather than on the worker.
    await waitForSubtreeTotal(page)

    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    // The rule is a running cost against a node-wide cap, so it does not outlive the file.
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    const row = page.getByTestId('data-table-row').filter({ hasText: KEY })
    // `toHaveCount` waits; `count()` on its own reads before the list has fetched and silently
    // skips the cleanup, which is how eight rules leaked into the dev node.
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    if (await row.count()) {
      const actions = rowActions(page, 'rollup-rule', row)
      await actions.menu.click()
      await actions.action('delete').click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^delete$/i })
        .click()
    }
    await page.close()
  })

  test('RU1: a parent with a contributing child shows a Derived card', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))

    const card = page.getByTestId('rollup-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(KEY)
    // Self + subtree: 10 kg here, 10 kg below. Never labelled "children" — the two overlap, and a
    // reader who adds them is double-counting the parent.
    await expect(page.getByTestId('rollup-line')).toBeVisible()
  })

  test('RU2: the split bar states what is below, not just the total', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))

    await expect(page.getByTestId('rollup-split-bar')).toBeVisible()
    // The bar is the only thing separating own from below, so it carries the accessible name — a
    // colour-only split states nothing to a screen reader.
    await expect(page.getByTestId('rollup-split-bar')).toHaveAttribute(
      'aria-label',
      /.+/
    )
  })

  test('RU5: the card survives the grid layout', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, PARENT))

    // `compact` changes RollupLine — no expander, dimensions counted rather than listed — and the
    // cards are rendered from a SECOND branch of the read view. Breaking one branch leaves the
    // other working, so a test that only ever looks at the default layout covers half the code.
    await page.getByRole('button', { name: /grid overview/i }).click()
    await expect(
      page.getByRole('button', { name: /grid overview/i })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('rollup-card')).toHaveCount(1)

    // Back to detailed before leaving: the view is stored per ACCOUNT, so RU3 below and every
    // later spec would otherwise read `grid`. The afterAll restore is the safety net for the run
    // where this line never executes.
    await page.getByRole('button', { name: /detailed view/i }).click()
    await expect(
      page.getByRole('button', { name: /detailed view/i })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('RU3: a leaf does not claim anything is below it', async ({ page }) => {
    // The child is reached through the PARENT, not `/objects`: the root list asks `parent: ''`, so
    // a child is not in it at all — a locator pointed at the root list waits the full timeout for
    // a row that is correctly absent.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, CHILD))

    // Wait for the sheet's own content first. Without it "no card" is also what an unloaded sheet
    // looks like, and the assertion below would pass for the wrong reason.
    await expect(sheet(page).getByText(KEY).first()).toBeVisible()

    // The regression `6842843` fixed. A leaf is the sole contributor to its own total, so a card
    // restating its own value in canonical units asserts something below that the reader cannot
    // see. The split bar is the specific claim that must not appear.
    await expect(page.getByTestId('rollup-split-bar')).toHaveCount(0)
  })
})
