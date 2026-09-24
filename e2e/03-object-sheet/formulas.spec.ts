import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { E2E_ROUND_TRIP_FORMULAS } from '../utils/formula-fixtures'
import { bind, chooseFormula, createFormula } from '../utils/formulas'
import { formulaSibling, siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  gotoList,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * A derived value is the one thing on this sheet the user does not type. The rules that make it
 * trustworthy are all invisible: the number is the SERVER's (the editor shows none of its own), a
 * constant pins its version at bind time, and turning a formula back into text has to send
 * `calc: null` — `undefined` leaves the server recomputing forever.
 */

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

async function createConstant(
  page: Page,
  name: string,
  value: string
): Promise<void> {
  await gotoList(page, '/constants')
  await tour(page, 'constantsCreate').click()
  await page.locator('#constant-name').fill(name)
  await page.locator('#constant-data').fill(value)
  await page
    .getByRole('button', { name: /create constant/i })
    .last()
    .click()
  await expect(rowFor(page, name)).toHaveCount(1)
}

/** A create sheet holding `properties`, with a further empty property ready for the formula. */
async function openSheetWith(
  page: Page,
  name: string,
  properties: { name: string; value: string }[]
): Promise<void> {
  await gotoList(page, '/objects')
  await tour(page, 'createObject').click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByLabel(/name/i).first().fill(name)

  for (const [index, property] of properties.entries()) {
    await addProperty(page, index)
    await fillProperty(page, index, property.name, property.value)
  }
}

/** Save, reopen in edit mode, and return the stored derived value of property `index`. */
async function savedDerivedValue(
  page: Page,
  objectName: string,
  index: number
) {
  await saveSheet(page)
  await expect(sheet(page)).toBeHidden()
  await openObjectSheet(page, rowFor(page, objectName))
  await enterEditMode(page)
  await expandProperty(page, index)
  return page.getByTestId(`derived-value-${index}-0`)
}

/**
 * Bind, then wait for the node's answer about the new bindings. The panel asks after a pause, so
 * an assertion that something is ABSENT passes at once, before any answer, unless it waits here.
 * Each call needs bindings not yet asked in this page: a cached answer sends no request to wait for.
 */
async function bindAndSettle(
  page: Page,
  variable: string,
  optionTestId: string
): Promise<void> {
  // The request must carry this binding: an earlier one's answer can still be on its way.
  const answered = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().includes('/formulas/preview') &&
      (r.request().postData() ?? '').includes(`"var":"${variable}"`)
  )
  await bind(page, variable, optionTestId)
  await answered
  await expect(
    page.getByTestId('formula-bindings').getByRole('status')
  ).toHaveAttribute('aria-busy', 'false')
}

/** A create sheet with `sources` and an empty property 1 set to `formulaName`. */
async function sheetWithFormula(
  page: Page,
  tag: string,
  formulaName: string,
  sources: { name: string; value: string }[]
): Promise<void> {
  await openSheetWith(page, `${tag}-obj`, sources)
  await addProperty(page, sources.length)
  await page.getByTestId(`property-name-${sources.length}`).fill('Result')
  await chooseFormula(page, sources.length, formulaName)
}

test.describe('03 - object sheet / formulas', () => {
  test('F1/F2/F3: mode flips, bindings render, and the server computes on save', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-mul`
    await createFormula(page, formulaName, 'x * 2')

    await openSheetWith(page, `${tag}-obj`, [{ name: 'Width', value: '10' }])
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Doubled')

    await expect(page.getByTestId('value-mode-1-0')).toHaveAttribute(
      'data-mode',
      'text'
    )
    await chooseFormula(page, 1, formulaName)

    // The variables come from the formula record, so an unbound one still has to be listed.
    await expect(page.getByTestId('formula-var-x')).toBeVisible()

    await bindAndSettle(page, 'x', siblingTestId('Width'))
    // No figure while binding: the editor says the server calculates it, and raises nothing.
    const bindings = page.getByTestId('formula-bindings')
    await expect(bindings.getByRole('status')).toContainText(
      /calculated when you save/i
    )
    await expect(page.getByTestId('formula-dimension-problem')).toHaveCount(0)

    const derived = await savedDerivedValue(page, `${tag}-obj`, 1)
    await expect(derived).toContainText('20')
    await expect(derived.getByTestId('provenance-error')).toHaveCount(0)
  })

  test('F10/F11: a blank sibling is bindable, a text one is not', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-sum`
    await createFormula(page, formulaName, 'a + b')

    await openSheetWith(page, `${tag}-obj`, [
      { name: 'Numeric', value: '4' },
      { name: 'Wordy', value: 'not a number' },
    ])
    await addProperty(page, 2)
    await page.getByTestId('property-name-2').fill('Blank')
    await addProperty(page, 3)
    await page.getByTestId('property-name-3').fill('Total')

    await chooseFormula(page, 3, formulaName)
    await page.getByTestId('formula-bind-a').click()

    // A template arrives with blanks already bound, so an empty sibling has to be offerable.
    await expect(formulaSibling(page, 'Blank')).toBeVisible()
    await expect(formulaSibling(page, 'Numeric')).toBeVisible()
    // Text would evaluate to NaN, so it is not a binding target at all.
    await expect(formulaSibling(page, 'Wordy')).toHaveCount(0)

    // Bound but unfilled: there is no question to ask yet, so the server is not asked one.
    let previews = 0
    page.on('request', (request) => {
      if (request.url().includes('/formulas/preview')) previews++
    })
    await formulaSibling(page, 'Blank').click()
    await bind(page, 'b', siblingTestId('Numeric'))
    // Past the settle wait, so a request that was going to be sent has been.
    await page.waitForTimeout(1_000)
    expect(previews).toBe(0)

    // The counter itself: once every binding holds something, the question does go out.
    await bind(page, 'a', siblingTestId('Numeric'))
    await expect.poll(() => previews).toBeGreaterThan(0)
  })

  test('F12: a constants-only formula evaluates with no sibling bindings', async ({
    page,
  }) => {
    const tag = stamp()
    const constantName = `${tag}-factor`
    const formulaName = `${tag}-const`
    await createConstant(page, constantName, '0.42')
    await createFormula(page, formulaName, 'f * 100')

    await openSheetWith(page, `${tag}-obj`, [])
    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('Share')
    await chooseFormula(page, 0, formulaName)

    await bind(page, 'f', `formula-constant-${constantName}`)
    await expect(await savedDerivedValue(page, `${tag}-obj`, 0)).toContainText(
      '42'
    )
  })

  for (const fixture of E2E_ROUND_TRIP_FORMULAS) {
    test(`F4/F5/F14: ${fixture.label} — the server stores the right number`, async ({
      page,
    }) => {
      const tag = stamp()
      const formulaName = `${tag}-rt`
      const objectName = `${tag}-obj`
      await createFormula(page, formulaName, fixture.expression)

      await openSheetWith(page, objectName, fixture.properties)
      const formulaIndex = fixture.properties.length
      await addProperty(page, formulaIndex)
      await page
        .getByTestId(`property-name-${formulaIndex}`)
        .fill(fixture.formulaPropertyName)
      await chooseFormula(page, formulaIndex, formulaName)

      for (const [variable, property] of Object.entries(
        fixture.variableMapping
      )) {
        await bind(page, variable, siblingTestId(property))
      }
      await saveSheet(page)
      await expect(sheet(page)).toBeHidden()

      // The number is the node's own: the editor computes nothing, so this is the only check.
      await openObjectSheet(page, rowFor(page, objectName))
      await enterEditMode(page)
      await expandProperty(page, formulaIndex)

      const derived = page.getByTestId(`derived-value-${formulaIndex}-0`)
      await expect(derived).toContainText(fixture.expectedResult)
      await expect(derived.getByTestId('provenance-chip')).toBeVisible()
      await expect(derived.getByTestId('provenance-error')).toHaveCount(0)
    })
  }

  test('F6: the pencil hydrates the recipe from the stored trace', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-hyd`
    const objectName = `${tag}-obj`
    await createFormula(page, formulaName, 'x * 3')

    await openSheetWith(page, objectName, [{ name: 'Base', value: '7' }])
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Tripled')
    await chooseFormula(page, 1, formulaName)
    await bind(page, 'x', siblingTestId('Base'))
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    await expandProperty(page, 1)

    await expect(page.getByTestId('derived-value-1-0')).toContainText('21')
    const pencil = page.getByTestId('derived-value-edit-1-0')
    await expect(pencil).toBeEnabled()
    await pencil.click()

    // Hydration rebuilds the recipe from the node's trace — the editor comes back bound, not blank.
    await expect(page.getByTestId('formula-bindings')).toBeVisible()
    await expect(page.getByTestId('formula-bind-x')).toContainText('Base')
  })

  test('F7: an un-hydratable formula disables the pencil and says why', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-inline`
    const objectName = `${tag}-obj`
    await createFormula(page, formulaName, 'x * 4')

    await openSheetWith(page, objectName, [{ name: 'Base', value: '2' }])
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Quad')
    await chooseFormula(page, 1, formulaName)
    await bind(page, 'x', siblingTestId('Base'))
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    // An INLINE expression has no formula to select, and the editor picks formulas rather than
    // typing them. The UI cannot author one, so the trace is rewritten on the way in — the branch
    // is real (core accepts inline calcs) and this is the only way to reach it from the browser.
    await page.route(/\/v1\/objects\/[0-9a-f-]{36}(\?|$)/, async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      for (const property of body.properties ?? []) {
        for (const value of property.values ?? []) {
          if (value.provenance) delete value.provenance.formulaId
        }
      }
      return route.fulfill({ response, json: body })
    })

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    await expandProperty(page, 1)

    // Disabled AND labelled: an enabled control that does nothing is the exact failure this guards.
    const pencil = page.getByTestId('derived-value-edit-1-0')
    await expect(pencil).toBeDisabled()
    await expect(pencil).toHaveAttribute('title', /formula|expression/i)
  })

  test('F8: opening an object with derived values and saving untouched rewrites nothing', async ({
    page,
    api,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-idle`
    const objectName = `${tag}-obj`
    await createFormula(page, formulaName, 'x + 1')

    await openSheetWith(page, objectName, [{ name: 'Seed', value: '41' }])
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Answer')
    await chooseFormula(page, 1, formulaName)
    await bind(page, 'x', siblingTestId('Seed'))
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    api.clear()

    // Nothing was touched, so there is no diff to send. Marking derived values dirty on load would
    // rewrite every formula on every open.
    await expect(page.getByTestId('sheet-save')).toBeDisabled()
    expect(api.count(/\/v1\/objects\/[0-9a-f-]{36}$/)).toBeLessThanOrEqual(1)
  })

  test('F9: turning a derived value back into text clears the calc', async ({
    page,
  }) => {
    const tag = stamp()
    const formulaName = `${tag}-undo`
    const objectName = `${tag}-obj`
    await createFormula(page, formulaName, 'x + 5')

    await openSheetWith(page, objectName, [{ name: 'Start', value: '10' }])
    await addProperty(page, 1)
    await page.getByTestId('property-name-1').fill('Plus')
    await chooseFormula(page, 1, formulaName)
    await bind(page, 'x', siblingTestId('Start'))
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    await expandProperty(page, 1)
    await page.getByTestId('derived-value-edit-1-0').click()
    await page.getByTestId('value-mode-1-0').click()
    await expect(page.getByTestId('value-mode-1-0')).toHaveAttribute(
      'data-mode',
      'text'
    )
    await page.getByTestId('property-value-1-0').fill('99')
    await saveSheet(page)

    // `calc: null` and not `undefined`: undefined is omitted from the PATCH, so the node would keep
    // recomputing the value the user just overwrote.
    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    await expandProperty(page, 1)

    await expect(page.getByTestId('derived-value-1-0')).toHaveCount(0)
    await expect(page.getByTestId('property-value-1-0')).toHaveValue('99')
  })

  test('F13: a constant is pinned at bind time and a new version does not move it', async ({
    page,
  }) => {
    const tag = stamp()
    const constantName = `${tag}-rate`
    const formulaName = `${tag}-pin`
    const objectName = `${tag}-obj`
    await createConstant(page, constantName, '2')
    await createFormula(page, formulaName, 'r * 10')

    await openSheetWith(page, objectName, [])
    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('Pinned')
    await chooseFormula(page, 0, formulaName)
    await bind(page, 'r', `formula-constant-${constantName}`)
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await page.goto('/constants')
    const constantRow = rowFor(page, constantName)
    await constantRow.getByTestId('constant-actions-dropdown').click()
    await page.getByTestId('constant-action-edit').click()
    await page.locator('#constant-data').fill('5')
    await page
      .getByRole('button', { name: /add version/i })
      .last()
      .click()
    await expect(page.getByTestId('entity-sheet')).toBeHidden()

    await page.goto('/objects')
    await openObjectSheet(page, rowFor(page, objectName))
    await enterEditMode(page)
    await expandProperty(page, 0)

    // Version-pinned at BIND time: appending 5 must not turn the stored 20 into 50, or every
    // historical calculation would silently restate itself.
    await expect(page.getByTestId('derived-value-0-0')).toContainText('20')
  })

  // The inputs are already in standard units, so a formula that divides by 1000 AND declares `t`
  // converts twice. The node answers before save; the result would otherwise read 0.0015 t.
  test('F15: a hand conversion is flagged before the value is saved', async ({
    page,
  }) => {
    const tag = stamp()
    await createFormula(page, `${tag}-tonnes`, 'a / 1000', 't')
    await sheetWithFormula(page, tag, `${tag}-tonnes`, [
      { name: 'Mass', value: '1500 kg' },
    ])

    await bindAndSettle(page, 'a', siblingTestId('Mass'))

    const warning = page.getByTestId('formula-warning-hand-conversion')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText(/1[,.]?000/)
    await expect(page.getByTestId('formula-dimension-problem')).toHaveCount(0)
  })

  test('F16: a result the node cannot check says so before save', async ({
    page,
  }) => {
    const tag = stamp()
    await createFormula(page, `${tag}-log`, 'log(a)')
    await sheetWithFormula(page, tag, `${tag}-log`, [
      { name: 'Mass', value: '1500 kg' },
    ])

    await bindAndSettle(page, 'a', siblingTestId('Mass'))

    await expect(page.getByTestId('formula-unit-unverified')).toBeVisible()
    await expect(page.getByTestId('formula-dimension-problem')).toHaveCount(0)
  })

  // Red, not amber: the node will store an error row with no number, and the panel says so.
  test('F17: a refused formula says no number will be stored', async ({
    page,
  }) => {
    const tag = stamp()
    await createFormula(page, `${tag}-sum`, 'a + b')
    await sheetWithFormula(page, tag, `${tag}-sum`, [
      { name: 'Mass', value: '1500 kg' },
      { name: 'Length', value: '2 m' },
    ])

    await bind(page, 'a', siblingTestId('Mass'))
    await bindAndSettle(page, 'b', siblingTestId('Length'))

    await expect(page.getByTestId('formula-dimension-problem')).toBeVisible()
    await expect(
      page.getByTestId('formula-bindings').getByRole('status')
    ).toContainText(/no number will be stored|geen getal/i)
  })

  test('F18: "How units work" opens the reference at its Units section', async ({
    page,
  }) => {
    const tag = stamp()
    await createFormula(page, `${tag}-mul`, 'x * 2')
    await sheetWithFormula(page, tag, `${tag}-mul`, [
      { name: 'Width', value: '10' },
    ])

    const help = page.getByTestId('formula-units-help')
    await help.click()
    await expect(page.getByTestId('formula-reference-units')).toBeInViewport()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('formula-reference-units')).toBeHidden()
    await expect(help).toBeFocused()
  })
})
