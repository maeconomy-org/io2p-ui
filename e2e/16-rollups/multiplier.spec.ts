import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * A rule that SCALES each contributor by another property on the same object — "10 chairs at 12 kg"
 * totals 120 kg, not 12.
 *
 * The cases here are the ones a unit test frames wrongly, because they are about what the object
 * sheet does with a number the node computed rather than about the arithmetic itself:
 *
 * - a multiplied LEAF used to have its card suppressed entirely. A leaf is its own sole
 *   contributor, and the card is normally hidden then because the total would restate the property
 *   row. With a multiplier it does not restate it — the row reads 12 kg and the total reads 60 kg —
 *   so hiding it lost the one figure the rule was created to produce.
 * - a quantity the normalizer cannot read (`"5 zakken"`) makes the node drop that object's WHOLE
 *   contribution. Nothing on the value said so, because the marker fired only for values bound by
 *   a FORMULA. This used to read `"5 stuks"`, which the table now parses as a count — so the case
 *   was passing for the wrong reason. If `zakken` is ever added as a unit, pick another word; the
 *   test needs a quantity the node genuinely cannot read, not merely an unusual one.
 *
 * Own fixture rather than a shared one: this needs two properties per object and a rule carrying a
 * multiplier, which no other file in this folder builds.
 */

const runId = Date.now()
const KEY = `mass${runId}`
const QTY = `qty${runId}`
const LEAF = `e2e-${runId}-mult-leaf`
const BAD = `e2e-${runId}-mult-unreadable`
const NEG = `e2e-${runId}-mult-negative`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** An object carrying the rolled-up value AND its quantity, which is what makes the rule bite. */
async function createScaledObject(
  page: Page,
  name: string,
  mass: string,
  quantity: string
) {
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)

  await addProperty(page, 0)
  await fillProperty(page, 0, KEY, mass)
  await addProperty(page, 1)
  await fillProperty(page, 1, QTY, quantity)

  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
}

/**
 * Open the object's sheet and poll until `predicate` holds.
 *
 * Slow by design, and the reason is worth stating once: storm control is per TARGET, so an entity
 * computed inside `ROLLUP_COOLDOWN_MS` (30s) is deferred whatever rule arrives next, and the reaper
 * re-drives on its own 30s tick. A rule created over data written moments ago — exactly this
 * fixture — therefore settles in ~60s, where the same rule over quiet data lands in under a second.
 */
async function pollObject(
  page: Page,
  name: string,
  predicate: (page: Page) => Promise<boolean>,
  what: string
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, name))
    await page.waitForTimeout(4_000)
    if (await predicate(page)) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(25_000)
  }
  throw new Error(`${name} never reached: ${what}`)
}

const hasCard = async (page: Page) =>
  (await page.getByTestId('rollup-card').count()) > 0

test.describe('16 - rollups / the quantity multiplier', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(300_000)
    const page = await browser.newPage()

    // Objects FIRST, then the rule. That order is itself part of the contract now: a rule created
    // over existing data used to compute never, and creating it now arms every holder of its key.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await createScaledObject(page, LEAF, '12 kg', '5')
    await createScaledObject(page, BAD, '7 kg', '5 zakken')
    await createScaledObject(page, NEG, '9 kg', '-2')

    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'rollupRulesCreate').click()
    await page.getByTestId('rollup-rule-property-key').fill(KEY)
    await page.getByTestId('rollup-rule-add-key').click()
    await page.getByTestId('rollup-rule-multiply-by').fill(QTY)
    await page.getByTestId('rollup-rule-submit').click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: KEY })
    ).toHaveCount(1, { timeout: 15_000 })

    await pollObject(page, LEAF, hasCard, 'a card from the multiplied rule')
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    const row = page.getByTestId('data-table-row').filter({ hasText: KEY })
    // `toHaveCount` WAITS; a bare `count()` reads before the list has fetched and skips the
    // cleanup silently. A rule is a running cost against a node-wide cap.
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

  test('RU24: a multiplied leaf still shows its total', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, LEAF))

    // Unmultiplied, this object would be its own sole contributor and the card would be correctly
    // suppressed as "This object only" — RU3 asserts exactly that for a plain rule. Scaled, the
    // total is a different number from the property row, so it has to be shown.
    await expect(page.getByTestId('rollup-card')).toHaveCount(1)
    await expect(page.getByTestId('rollup-only-self')).toHaveCount(0)
  })

  test('RU25: the total is scaled, not a copy of the value', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, LEAF))

    // 12 kg at a quantity of 5, so the total is 60 and the line says how many things it counted.
    // The pair — the scaled total and the count — is what separates "the multiplier ran" from
    // "the value was copied up"; either number alone is satisfied by the wrong build.
    const card = page.getByTestId('rollup-card')
    await expect(card).toContainText('60')

    const unitCount = page.getByTestId('rollup-unit-count')
    await expect(unitCount).toContainText('5')

    // And it claims nothing about what one of them weighs. `num / unitCount` is a MEAN, not a
    // per-unit weight — five chairs at 12 kg beside two at 30 kg printed "7 × 17.143 kg", a figure
    // nobody authored (`d28336e`). The absence is anchored by the count assertion above, so this
    // cannot pass on a line that stopped rendering.
    await expect(unitCount).not.toContainText('kg')
  })

  test('RU26: a quantity the node cannot read is marked on the value', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await openObjectSheet(page, rowFor(page, BAD))

    // The property cards open COLLAPSED, and the marker lives on the value row inside — so it has
    // to be expanded before it can be asserted. Worth stating: a value quietly removing an object
    // from a total is only one click from invisible.
    await page
      .getByRole('button', { name: new RegExp(QTY) })
      .first()
      .click()

    // "5 zakken" is not a unit in any table, so it never parses, and the node refuses it rather
    // than defaulting to one — dropping this object's whole contribution. The marker used to fire
    // only for values a FORMULA bound, so nothing on screen said so.
    await expect(
      page.locator(
        '[data-testid="value-normalization"][data-marker="excluded"]'
      )
    ).toBeVisible()
  })

  // Negative is one of the quantities the node refuses rather than reads: the object drops out of
  // the total, so the value says so in read mode AND while it is being edited.
  test('RU27: a negative quantity is marked in read and edit mode', async ({
    page,
  }) => {
    const excluded = page.locator(
      '[data-testid="value-normalization"][data-marker="excluded"]'
    )
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    // Read mode learns which key is a quantity from the object's rollup entries.
    const entries = page.waitForResponse(
      (r) => r.request().method() === 'GET' && /\/rollups(\?|$)/.test(r.url())
    )
    await openObjectSheet(page, rowFor(page, NEG))
    await entries

    await page
      .getByRole('button', { name: new RegExp(QTY) })
      .first()
      .click()
    await expect(excluded).toBeVisible()

    await enterEditMode(page)
    await expandProperty(page, 1)
    await expect(excluded).toBeVisible()
  })
})
