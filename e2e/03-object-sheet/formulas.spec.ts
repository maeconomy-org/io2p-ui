import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { E2E_ROUND_TRIP_FORMULAS } from '../utils/formula-fixtures'
import { formulaSibling, siblingTestId, tour } from '../utils/selectors'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  gotoList,
  openDialog,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * A derived value is the one thing on this sheet the user does not type. The rules that make it
 * trustworthy are all invisible: the preview must be the number the SERVER will store, a constant
 * pins its version at bind time, and turning a formula back into text has to send `calc: null` —
 * `undefined` leaves the server recomputing forever.
 */

const stamp = () => `e2e-${Date.now()}`

function rowFor(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

/** Formulas are immutable, so each run mints its own rather than binding to a shared one. */
async function createFormula(
  page: Page,
  name: string,
  expression: string
): Promise<void> {
  await gotoList(page, '/formulas')
  await tour(page, 'formulasCreate').click()
  const dialog = await openDialog(page)
  await dialog.getByLabel(/name/i).first().fill(name)
  await dialog.getByLabel(/expression/i).fill(expression)
  await page
    .getByRole('button', { name: /create formula/i })
    .last()
    .click()
  await expect(rowFor(page, name)).toHaveCount(1)
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

/** Switch value 0 of `index` into formula mode and choose `formulaName`. */
async function chooseFormula(
  page: Page,
  index: number,
  formulaName: string
): Promise<void> {
  await page.getByTestId(`value-mode-${index}-0`).click()
  await expect(page.getByTestId(`value-mode-${index}-0`)).toHaveAttribute(
    'data-mode',
    'formula'
  )
  await page.getByTestId('formula-select').click()
  await page.getByTestId(`formula-option-${formulaName}`).click()
}

async function bind(
  page: Page,
  variable: string,
  optionTestId: string
): Promise<void> {
  await page.getByTestId(`formula-bind-${variable}`).click()
  // The picker is a Popover, not a Select: it ANIMATES out, so binding a second variable while the
  // first popover is still unmounting puts two option lists in the DOM and the click resolves to
  // two elements. Scope to the open one rather than waiting on a duration.
  const open = page.locator('[data-state="open"][role="dialog"]').last()
  await open.getByTestId(optionTestId).click()
  await expect(page.getByTestId(optionTestId)).toHaveCount(0)
}

test.describe('03 - object sheet / formulas', () => {
  test('F1/F2/F3: mode flips, bindings render, and the preview computes', async ({
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
    await expect(page.getByTestId('formula-preview')).toHaveCount(0)

    await bind(page, 'x', siblingTestId('Width'))
    await expect(page.getByTestId('formula-preview')).toContainText('20')
    await expect(page.getByTestId('formula-preview')).toHaveAttribute(
      'data-error',
      'false'
    )
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

    await formulaSibling(page, 'Blank').click()
    // Bound but unfilled: there is nothing honest to preview yet.
    await expect(page.getByTestId('formula-preview')).toHaveCount(0)
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
    await expect(page.getByTestId('formula-preview')).toContainText('42')
  })

  for (const fixture of E2E_ROUND_TRIP_FORMULAS) {
    test(`F4/F5/F14: ${fixture.label} — the preview is what the server stores`, async ({
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
      await expect(page.getByTestId('formula-preview')).toContainText(
        fixture.expectedResult
      )

      await saveSheet(page)
      await expect(sheet(page)).toBeHidden()

      // The client mirrors core's expr-eval and its 12-significant-figure rounding, so the number
      // the preview showed has to be the number the node computed — not an approximation of it.
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

    const pencil = page.getByTestId('derived-value-edit-1-0')
    await expect(pencil).toBeEnabled()
    await pencil.click()

    // Hydration rebuilds the recipe from the node's trace — the editor comes back bound, not blank.
    await expect(page.getByTestId('formula-bindings')).toBeVisible()
    await expect(page.getByTestId('formula-bind-x')).toContainText('Base')
    await expect(page.getByTestId('formula-preview')).toContainText('21')
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
    await expect(page.getByTestId('formula-preview')).toContainText('20')
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
})
