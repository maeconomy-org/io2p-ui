import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  expandProperty,
  fillProperty,
  gotoList,
  openCreateSheet,
  openDialog,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * Starting an object FROM a template, which is the surface `5df2f1c` fixed and nothing drove.
 *
 * A templates list row is LEAN: it carries identity and drops `properties` entirely. Without
 * `full: true` every pick prefilled the NAME and nothing else — no error, no empty state, just a
 * create form that looked like a normal empty one. That is the silent-fallback class this suite
 * exists for, and the reason C7 asserts on the REQUEST: by the time the form renders, a template
 * with no properties and a request that forgot to ask for them are indistinguishable.
 *
 * The unit test at `template-selector.test.tsx` pins the flag against a mock. This pins it against
 * the node, which is the half that can drift: `useList` is typed `Page<TemplateListItem>` whatever
 * the query says, so nothing in the type system relates the flag to what comes back.
 */

const runId = Date.now()
const TEMPLATE = `e2e-${runId}-tpl-source`
const CALC_TEMPLATE = `e2e-${runId}-tpl-calc`
const FORMULA = `e2e-${runId}-double`
const PROPS = [
  { name: 'Material', value: 'concrete' },
  { name: 'Thickness', value: '200' },
] as const

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

/** The option for a template, addressed by NAME — a spec never learns the id. */
function optionFor(page: Page, name: string) {
  return page
    .locator('[data-testid^="template-option-"]')
    .filter({ hasText: name })
    .first()
}

async function openSelector(page: Page, name: string) {
  await page.getByTestId('template-selector').click()
  // Search server-side rather than scrolling: the popover asks for 8 rows and this account holds
  // far more templates than that.
  await page.getByRole('combobox').last().fill(name)
  const option = optionFor(page, name)
  await expect(option).toBeVisible()
  return option
}

test.describe('03 - object sheet / template selector', () => {
  test.describe.configure({ mode: 'serial' })

  /**
   * One template with two properties, created through the UI so the shape is whatever the app
   * really writes rather than whatever a fixture believes it writes.
   */
  test.beforeAll(async ({ browser }, testInfo) => {
    // A hook has its own 60s budget and `test.setTimeout` does not reach it.
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()

    await page.goto('/templates')
    await expect(page.getByTestId('data-table').last()).toBeVisible()
    await tour(page, 'templatesCreate').click()
    await page.getByRole('menuitem', { name: /object/i }).click()
    await expect(sheet(page)).toBeVisible()

    await sheet(page).getByLabel(/name/i).first().fill(TEMPLATE)
    for (const [index, prop] of PROPS.entries()) {
      await addProperty(page, index)
      await fillProperty(page, index, prop.name, prop.value)
    }
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(rowFor(page, TEMPLATE)).toHaveCount(1)

    // A second template whose value is a FORMULA. Formulas are immutable, so each run mints its
    // own rather than binding to one a previous run left behind.
    await gotoList(page, '/formulas')
    await tour(page, 'formulasCreate').click()
    const dialog = await openDialog(page)
    await dialog.getByLabel(/name/i).first().fill(FORMULA)
    await dialog.getByLabel(/expression/i).fill('x * 2')
    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()
    await expect(rowFor(page, FORMULA)).toHaveCount(1)

    await gotoList(page, '/templates')
    await tour(page, 'templatesCreate').click()
    await page.getByRole('menuitem', { name: /object/i }).click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByLabel(/name/i).first().fill(CALC_TEMPLATE)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Width', '10')
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Doubled')
    await page.getByTestId('value-mode-1-0').click()
    await expect(page.getByTestId('value-mode-1-0')).toHaveAttribute(
      'data-mode',
      'formula'
    )
    await page.getByTestId('formula-select').click()
    await page.getByTestId(`formula-option-${FORMULA}`).click()
    await page.getByTestId('formula-bind-x').click()
    const open = page.locator('[data-state="open"][role="dialog"]').last()
    await open.getByTestId(siblingTestId('Width')).click()
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(rowFor(page, CALC_TEMPLATE)).toHaveCount(1)

    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('C7: the selector asks for the FULL preset, never a lean row', async ({
    page,
    api,
  }) => {
    await openCreateSheet(page)
    // Cleared so the set is the SELECTOR's own calls. Asserting over every `/templates?` request in
    // the test is stronger than the contract: a lean list is the RIGHT shape for a table, so the day
    // anything else on this path lists templates leanly, C7 would go red on correct behaviour while
    // wearing the name of a regression it is not.
    api.clear()
    await openSelector(page, TEMPLATE)

    // Every templates call the selector made, not just one of them: `keepPreviousData` and the
    // search box mean the count varies, while the flag must hold on all of them. `_rsc` filtered
    // out — Next's own route prefetch also hits `/templates`.
    const calls = api
      .matching(/\/templates\?/)
      .filter((r) => !r.path.includes('_rsc'))

    expect(
      calls.length,
      'the selector made no templates request'
    ).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.path, 'a lean row is the regression').toContain('full=true')
    }
  })

  test('C8: a row states how many properties the template carries', async ({
    page,
  }) => {
    await openCreateSheet(page)
    const option = await openSelector(page, TEMPLATE)

    // The count is the only thing on the row that can only come from the full preset, so it is
    // also the earliest place a lean response shows up to a reader.
    await expect(
      option.getByTestId('template-option-property-count')
    ).toContainText(String(PROPS.length))
  })

  test('C6: picking a template prefills the name AND every property', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)
    const option = await openSelector(page, TEMPLATE)
    await option.click()

    await expect(panel.getByLabel(/name/i).first()).toHaveValue(TEMPLATE)

    // Both properties, with their values — the regression prefilled the name and stopped. Asserting
    // only the name would have passed against the bug this case exists for.
    for (const [index, prop] of PROPS.entries()) {
      await expandProperty(page, index)
      await expect(page.getByTestId(`property-name-${index}`)).toHaveValue(
        prop.name
      )
      await expect(page.getByTestId(`property-value-${index}-0`)).toHaveValue(
        prop.value
      )
    }
    await expect(page.getByTestId(`property-row-${PROPS.length}`)).toHaveCount(
      0
    )
  })

  test('C6b: a name already typed survives the pick', async ({ page }) => {
    const typed = `e2e-${runId}-typed-first`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(typed)

    const option = await openSelector(page, TEMPLATE)
    await option.click()

    // `applyTemplate` copies the name ONLY into an empty field — overwriting what someone just
    // typed would be the more obvious implementation and the wrong one. The properties still apply.
    await expect(panel.getByLabel(/name/i).first()).toHaveValue(typed)
    // The property CONTENT, not merely that a row exists. A bare row assertion only catches the
    // "bails out entirely" variant if a fresh create sheet renders no rows — true today, but a
    // fixture detail nothing states. This distinguishes "applied the preset" from "rendered an
    // empty row" without depending on it.
    //
    // C6 is the other half of this pair: it pins copy-WHEN-empty, and only together do the two say
    // "only into an empty field". Deleting C6 silently weakens this case.
    // Expanded first: a loaded row renders COLLAPSED and Radix unmounts a collapsed body, so the
    // name input does not exist until it is opened.
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-name-0')).toHaveValue(PROPS[0].name)
  })

  test('C9: a template formula arrives as a formula, not as text', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)
    const option = await openSelector(page, CALC_TEMPLATE)
    await option.click()

    await expect(panel.getByLabel(/name/i).first()).toHaveValue(CALC_TEMPLATE)

    // Not `expandProperty`: that waits for a value input or a computed derived value, and a formula
    // row in a CREATE sheet has neither yet — nothing has been saved, so there is no number. It
    // opens straight into the formula editor.
    await page.getByTestId('property-toggle-1').click()
    await expect(page.getByTestId('value-mode-1-0')).toBeVisible()

    // `data-mode`, not the rendered text. A dropped `calc` leaves a value that still LOOKS filled —
    // it just became a plain string — which is why the preset type carrying only `{data}` lost
    // every template formula without anything failing.
    await expect(page.getByTestId('value-mode-1-0')).toHaveAttribute(
      'data-mode',
      'formula'
    )
    await expect(page.getByTestId('formula-select')).toBeVisible()

    // And the recipe's argument still resolves: the preset keeps the sibling value's `ref`
    // verbatim, so a binding minted against the template is still pointing at Width here.
    await expect(page.getByTestId('formula-var-x')).toBeVisible()
  })
})
