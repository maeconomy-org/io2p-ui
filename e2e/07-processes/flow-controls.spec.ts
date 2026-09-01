import { expect, test } from '../fixtures/app'
import { addFlow, createObjectWithId } from '../utils/process'
import { tour } from '../utils/selectors'
import { saveSheet, sheet, switchTab } from '../utils/sheet'
import { selectView } from '../utils/views'

/**
 * The two controls the flow view carries, and which of them belongs where.
 *
 * The unit picker used to sit in the toolbar beside the depth pager, which put a control that
 * explains the LEGEND ("widths are drawn in…") next to controls that change what is fetched. It
 * moved into the legend it annotates. Both had shipped testids and neither had ever been asserted.
 *
 * Not `.read.`: the Sankey is an account preference, and the fixture creates a process.
 */

const runId = Date.now()
const PROCESS = `e2e-${runId}-units`

/**
 * Never assume the view. The choice is an account preference, so the previous case in this file
 * leaves it on Sankey — waiting for `data-table` here asserted a default and failed on a page that
 * was rendering correctly.
 */
async function gotoProcesses(page: import('@playwright/test').Page) {
  await page.goto('/processes')
  // `.last()` is the ARRIVING page. `page.goto` resolves before React tears the previous route
  // down, so both carry the selector for a moment and a bare assertion dies on strict mode — which
  // reads like a duplicated testid rather than a transition still in progress.
  await expect(page.getByTestId('view-option-sankey').last()).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('07 - processes / flow controls', () => {
  /**
   * The control renders only when the graph is genuinely mixed — "one dimension needs no choice" —
   * and the graph is the WHOLE account, not one process. So the fixture has to put two dimensions
   * in it rather than hope the account already holds them.
   */
  test.beforeAll(async ({ browser }, testInfo) => {
    // A hook has its own 60s budget and `test.setTimeout` does not touch it. Four creates and a
    // save is over that on a cold node, and it presents as an absent control.
    testInfo.setTimeout(180_000)

    const page = await browser.newPage()
    const input = `${PROCESS}-in`
    const output = `${PROCESS}-out`
    await createObjectWithId(page, input)
    await createObjectWithId(page, output)

    await page.goto('/processes')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await tour(page, 'processesCreate').click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByLabel(/name/i).first().fill(PROCESS)

    // `10 kg` against a bare `4`: the node parses the unit off the quantity, so one process is
    // enough to make `unitBreakdown` return two buckets.
    await switchTab(page, 'inputs')
    await addFlow(page, 'inputs', 0, input, '10 kg')
    await switchTab(page, 'outputs')
    await addFlow(page, 'outputs', 0, output, '4')

    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await page.close()
  })

  /**
   * `afterEach`, on the test's OWN page. The view is an account preference and every file after
   * this one opens `/processes` expecting the table — `07-processes/flows`, `related` and
   * `validation` all wait on `data-table` and fail with a snapshot showing a perfectly healthy
   * Sankey. Restoring once at the end of the file leaves that window open for every case in it.
   */
  test.afterEach(async ({ page }) => {
    await gotoProcesses(page)
    await selectView(page, 'table')
  })

  test('PR19: the unit control lives in the legend, not the toolbar', async ({
    page,
  }) => {
    await gotoProcesses(page)
    await selectView(page, 'sankey')

    const legend = page.getByTestId('flow-legend')
    await expect(legend).toBeVisible({ timeout: 30_000 })

    // One on the page, and it is inside the legend. Asserting only that the legend contains one
    // would still pass with a second copy left behind in the toolbar.
    await expect(page.getByTestId('flow-unit-select')).toHaveCount(1)
    await expect(legend.getByTestId('flow-unit-select')).toBeVisible()
    await expect(legend.getByTestId('flow-unit-help')).toBeVisible()
  })

  test('PR20: the depth pager stays in the toolbar, above the chart', async ({
    page,
  }) => {
    await gotoProcesses(page)
    await selectView(page, 'sankey')

    const legend = page.getByTestId('flow-legend')
    await expect(legend).toBeVisible({ timeout: 30_000 })

    // The half that did NOT move. Without it, deleting the unit control entirely would pass PR19.
    await expect(page.getByTestId('flow-depth-indicator')).toBeVisible()
    await expect(legend.getByTestId('flow-depth-indicator')).toHaveCount(0)
    await expect(legend.getByTestId('flow-depth-prev')).toHaveCount(0)
  })

  test('PR21: picking the other unit changes what the widths are drawn in', async ({
    page,
  }) => {
    await gotoProcesses(page)
    await selectView(page, 'sankey')

    const trigger = page
      .getByTestId('flow-legend')
      .getByTestId('flow-unit-select')
    await expect(trigger).toBeVisible({ timeout: 30_000 })

    const before = (await trigger.textContent())?.trim() ?? ''
    await trigger.click()
    // The chart is a canvas, so the choice is read back off the control. `activeUnit` is what feeds
    // the widths, and a trigger that never changes means `onActiveUnitChange` is not wired.
    const other = page
      .getByRole('option')
      .filter({ hasNotText: before })
      .first()
    await expect(other).toBeVisible()
    await other.click()

    await expect(trigger).not.toHaveText(before)
  })
})
