import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { openWizard, statValue } from '../utils/import'
import { openObjectSheet, sheet } from '../utils/sheet'
import { rowActions, tour } from '../utils/selectors'

/**
 * The seam between the two halves of the product that each had their own idea of a property key.
 *
 * A rollup rule matches `search.k` EXACTLY — core lowercases the key and does nothing else — so an
 * import that spelled a column `mass_1` where the typed property field writes `mass-1` produced
 * rows no rule could ever sum. Nothing failed: the objects imported, the rule saved, the values
 * were visible in both sheets, and the total was simply absent. The two halves had no test that
 * ever met, which is why the divergence survived being written down as a contract.
 *
 * So the header below is deliberately MULTI-WORD: the separator is the thing under test, and a
 * single-word key would pass under either spelling.
 */

const runId = Date.now()
/** Typed into the rule, and the sheet's column header. One string, two code paths. */
const PROPERTY = `Mass ${runId}`
/** The normalized form both paths must agree on. Hyphen, because the header has a space. */
const KEY = `mass-${runId}`
const PARENT = `e2e-${runId}-imp-building-a`
const CHILD = `e2e-${runId}-imp-floor-a`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/**
 * Two levels in one sheet, because a rollup needs an ancestor to total onto. The parent rows carry
 * no value of their own — the sum can only come from the children the import created under them.
 *
 * Every name is unique and none is a prefix of another, so a row filter cannot match two objects.
 */
function hierarchySheet() {
  return {
    name: `${PARENT}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        `Building,Floor,${PROPERTY}`,
        `${PARENT},${CHILD},12 kg`,
        `${PARENT},e2e-${runId}-imp-floor-b,8 kg`,
        `e2e-${runId}-imp-building-b,e2e-${runId}-imp-floor-c,5 kg`,
        `e2e-${runId}-imp-building-b,e2e-${runId}-imp-floor-d,3 kg`,
      ].join('\n'),
      'utf8'
    ),
  }
}

test.describe('16 - rollups / imported objects', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    // `KEY`, not `PROPERTY`. The rule normalizes on the way in — RR1 is the case for that — so the
    // list renders `mass-<runId>` and never the spaced, capitalised form that was typed. Filtering
    // on the typed string found nothing on every run and leaked the rule it was written to remove.
    // Exact, because `hasText` is a substring match and these keys share a prefix.
    const row = page
      .getByTestId('data-table-row')
      .filter({ has: page.getByText(KEY, { exact: true }) })
    // `toHaveCount` WAITS; a bare `count()` reads before the list has fetched and skips the
    // cleanup silently, leaving a rule running against the dev node forever.
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

  test('RU20: a rule normalizes a typed name the same way the importer will', async ({
    page,
  }) => {
    // The rule is created first, but that is no longer load-bearing: a rule change now arms every
    // holder of its key, so either order converges (RU9 pins that). What this case is actually
    // about is the SPELLING — that a hand-typed name normalizes to the key the importer writes.
    await page.goto('/rollup-rules')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'rollupRulesCreate').click()
    await page.getByTestId('rollup-rule-property-key').fill(PROPERTY)

    // The hint renders only when normalization CHANGED the input, which is the case worth pinning:
    // the user typed a space and gets a hyphen. It is the one place the key is visible before the
    // node has it, and asserting the spelling here is what catches a divergence from the importer.
    await expect(page.getByText(`Saved as ${KEY}`)).toBeVisible()

    await page.getByTestId('rollup-rule-add-key').click()
    await expect(page.getByTestId('rollup-rule-queued-keys')).toContainText(KEY)

    await page.getByTestId('rollup-rule-submit').click()
    await expect(
      page.getByTestId('data-table-row').filter({ hasText: KEY })
    ).toHaveCount(1)
  })

  test('RU21: an imported column keys the same as a typed property', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000)

    await openWizard(page)
    await page.getByTestId('import-file-input').setInputFiles(hierarchySheet())
    await page.getByTestId('wizard-next').click()

    // Levels set by hand rather than through Suggest: the suggester is a heuristic with its own
    // thresholds, and a spec that went through it would fail when those move for reasons that have
    // nothing to do with keys. The hierarchy is a precondition here, not the subject.
    await page.getByTestId('map-level-0').click()
    await page.getByTestId('map-level-1').click()
    await expect(page.getByTestId('map-column-2')).toContainText(PROPERTY)

    await page.getByTestId('wizard-next').click()
    // 2 buildings + 4 floors; the value sits on the floors, so the buildings hold none.
    expect(await statValue(page, 'objects')).toBe(6)
    expect(await statValue(page, 'values')).toBe(4)

    await page.getByTestId('wizard-next').click()
    await page.getByTestId('run-start').click()
    await expect(page.getByTestId('run-handed-over')).toBeVisible({
      timeout: 30_000,
    })
  })

  /**
   * ⏸ STILL DEFERRED, but for a different reason than before — the original one is fixed.
   *
   * It was deferred because the parent's `/rollups` carried every seed rule and no entry for this
   * run's user rule: the arming gap, where a rule created after the last write computed never.
   * That is fixed, and measured here rather than assumed — during a run of this file the node held
   * the live rule, 4 holders of its key, and SIX computed state rows covering both buildings. The
   * totals exist.
   *
   * What still fails is this fixture's reach. The poll looks for the building by name in the ROOT
   * list, and the account accumulates objects across the suite, so the row is not reliably on the
   * page it examines — the loop then inspects nothing and reports the total as missing. Driving
   * the search dialog instead did not survive headless either.
   *
   * To finish it: give the objects list a `?q=` the spec can navigate to, or seed this file its own
   * account. Do NOT re-enable it by lengthening the poll — the wait was never the problem.
   *
   * Renamed from RU22, which `cross-user.spec.ts` already uses.
   */
  test.fixme('RU27: the rule totals the imported value onto the parent', async ({
    page,
  }, testInfo) => {
    // ~70s to settle by contract (a 30s cooldown, then a reaper scanning every 30s), so this
    // polls rather than comparing arithmetic across the write.
    testInfo.setTimeout(300_000)

    for (let attempt = 0; attempt < 8; attempt++) {
      await page.goto('/objects')
      await expect(page.getByTestId('data-table')).toBeVisible()

      const parent = rowFor(page, PARENT)
      if ((await parent.count()) > 0) {
        await openObjectSheet(page, parent)
        await page.waitForTimeout(4_000)
        const card = page.getByTestId('rollup-card').filter({ hasText: KEY })
        if ((await card.count()) > 0) {
          // 12 + 8, from the two floors imported under this building. The parent authored no
          // property under this key, so the number can only have come from the imported children
          // via a rule that was typed by hand — which is the whole seam.
          await expect(card).toContainText('20')
          return
        }
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(25_000)
    }
    throw new Error(
      `no rollup card for ${KEY} on the imported parent — the importer and the rule disagree on the key`
    )
  })

  test('RU23: the imported property reads as a label, never as its key', async ({
    page,
  }) => {
    // Through the PARENT. `/objects` asks `parent: ''`, so it lists ROOTS — a locator for an
    // imported child points at a row that is correctly absent and waits the full timeout for it.
    // This case had never actually run: RU22 failed ahead of it in a serial file and it inherited
    // the skip.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table').last()).toBeVisible()
    await rowFor(page, PARENT).dblclick()
    await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)
    await openObjectSheet(page, rowFor(page, CHILD))

    // Key is identity, label is language. The importer persists the header verbatim as the label,
    // so the hyphenated key must not surface — the same invariant PVAL4 pins for typed properties.
    await expect(sheet(page).getByText(PROPERTY, { exact: true })).toBeVisible()
    await expect(sheet(page).getByText(KEY, { exact: true })).toHaveCount(0)
  })
})
