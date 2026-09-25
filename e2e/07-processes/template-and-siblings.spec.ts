import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { addFlow, createObjectWithId } from '../utils/process'
import { rowActions, siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  fillProperty,
  gotoList,
  openDialog,
  saveSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * The two things a PROCESS sheet does that an object sheet cannot.
 *
 * PR6 — a process template scaffolds flow rows, not just properties. It runs through the same
 * `TemplateSelector` the object create uses, but a process template also carries `inputs`/`outputs`
 * presets, and those are dropped by a lean list row exactly like properties are. The object half is
 * `03-object-sheet/template-selector.spec.ts`; this is the half where a silent drop costs the
 * shape of the process rather than a couple of fields.
 *
 * PR14 — D76: a process is ONE entity for calc purposes, so a derived value's siblings span the
 * process's own properties AND every flow. `process-sheet.tsx` feeds every picker the union rather
 * than whichever bag the value sits in, which is what lets a formula in an OUTPUT read a value on
 * an INPUT. Nothing drove it, and the failure mode is a picker that silently lists too little.
 */

const runId = Date.now()
const TEMPLATE = `e2e-${runId}-proc-tpl`
const REF = `e2e-${runId}-proc-ref`
const FORMULA = `e2e-${runId}-proc-double`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function openProcessCreate(page: Page) {
  await gotoList(page, '/processes')
  await tour(page, 'processesCreate').click()
  await expect(sheet(page)).toBeVisible()
}

test.describe('07 - processes / template and siblings', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }, testInfo) => {
    // A hook has its own 60s budget and `test.setTimeout` does not reach it.
    testInfo.setTimeout(300_000)
    const page = await browser.newPage()

    await createObjectWithId(page, REF)

    // A PROCESS template with a property and a flow on each side — the shape PR6 asserts survives
    // the trip through the selector.
    await gotoList(page, '/templates')
    await tour(page, 'templatesCreate').click()
    await page.getByRole('menuitem', { name: /process/i }).click()
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByLabel(/name/i).first().fill(TEMPLATE)
    // A template CREATE sheet is LINEAR — no tabs, everything on one form. The process create sheet
    // IS tabbed, and that asymmetry is what makes a shared `switchTab` wrong in exactly one of the
    // two places it looks like it belongs.
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Material', 'concrete')
    // A SECOND input, because the template sheet already opens with one slot per side. One row
    // proves nothing about the template — two can only have come from it.
    await page.getByTestId('add-input').click()
    await expect(page.getByTestId('flow-row-inputs-1')).toBeVisible()
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

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

    await page.close()
  })

  test.afterAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const page = await browser.newPage()
    await gotoList(page, '/templates')
    const row = rowFor(page, TEMPLATE)
    // TOLERANT of a template that was never created — the half-failed `beforeAll` case, which is
    // exactly when this hook matters most. Asserting count 1 throws there and aborts the cleanup.
    let seen = false
    for (let attempt = 0; attempt < 12; attempt++) {
      if ((await row.count()) > 0) {
        seen = true
        break
      }
      await page.waitForTimeout(500)
    }
    if (!seen) {
      await page.close()
      return
    }
    const actions = rowActions(page, 'template', row)
    await actions.menu.click()
    await actions.action('delete').click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
    await page.close()
  })

  test('PR6: a process template scaffolds its flow rows, not just its properties', async ({
    page,
  }) => {
    await openProcessCreate(page)

    await page.getByTestId('template-selector').click()
    await page.getByRole('combobox').last().fill(TEMPLATE)
    const option = page
      .locator('[data-testid^="template-option-"]')
      .filter({ hasText: TEMPLATE })
      .first()
    await expect(option).toBeVisible()
    await option.click()

    await expect(sheet(page).getByLabel(/name/i).first()).toHaveValue(TEMPLATE)
    await expect(page.getByTestId('property-row-0')).toBeVisible()

    // The SECOND input row is the assertion. A create sheet opens with one slot per side already
    // (TP2 pins that), so asserting row 0 exists would pass against a template that contributed
    // nothing — the vacuous version of this case. Row 1 can only have come from the preset.
    await switchTab(page, 'inputs')
    await expect(page.getByTestId('flow-row-inputs-1')).toBeVisible()
  })

  test('PR14: a formula in one flow binds to a value in another', async ({
    page,
  }) => {
    const name = `e2e-${Date.now()}-pr14`
    await openProcessCreate(page)
    await sheet(page).getByLabel(/name/i).first().fill(name)

    // A property on the PROCESS itself, for PR14's second arm. It sits on the details tab, which is
    // where the create sheet opens.
    await addProperty(page, 0)
    await fillProperty(page, 0, 'Batch', '7')

    // Unlike the TEMPLATE sheet, a process create sheet opens with no flow rows at all — the slots
    // have to be added. `addFlow` also picks the ref, which a save would require anyway.
    //
    // The added property lands at index 1, not 0: a flow's QUANTITY is an ordinary flow property
    // holding index 0, so the row this adds is always the second one.
    await switchTab(page, 'inputs')
    await addFlow(page, 'inputs', 0, REF, '10')
    await page.getByTestId('flow-toggle-inputs-0').click()
    const inputFlow = page.getByTestId('flow-row-inputs-0')
    await inputFlow.getByTestId('add-property').click()
    await inputFlow.getByTestId('property-name-1').fill('Width')
    await inputFlow.getByTestId('property-value-1-0').fill('10')

    await switchTab(page, 'outputs')
    await addFlow(page, 'outputs', 0, REF, '4')
    await page.getByTestId('flow-toggle-outputs-0').click()
    const outputFlow = page.getByTestId('flow-row-outputs-0')
    await outputFlow.getByTestId('add-property').click()
    await outputFlow.getByTestId('property-name-1').fill('Doubled')
    await outputFlow.getByTestId('value-mode-1-0').click()
    await page.getByTestId('formula-select').click()
    await page.getByTestId(`formula-option-${FORMULA}`).click()
    await page.getByTestId('formula-bind-x').click()

    // D76 in one assertion: the picker opened on an OUTPUT flow offers a value that lives on an
    // INPUT one. Fed only its own bag it would be empty here, and an empty picker looks like a
    // formula with nothing to bind rather than a union that was never assembled.
    const open = page.locator('[data-state="open"][role="dialog"]').last()
    await expect(open.getByTestId(siblingTestId('Width'))).toBeVisible()

    // BOTH ARMS. The docblock says the union spans "the process's own properties AND every flow",
    // and the assertion above only proves flow-to-flow. An implementation that unioned the flows
    // and dropped the process-level bag would pass it while breaking half of what D76 promises.
    await expect(open.getByTestId(siblingTestId('Batch'))).toBeVisible()
  })
})
