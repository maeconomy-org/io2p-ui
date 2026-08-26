import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

/**
 * A formula's result unit — D108-D111, the other half of the rollups chain.
 *
 * Before it, every formula result carried a number and no unit, so it landed in the `unitless`
 * bucket and was silently excluded from the total for its own key. Always. The declaration is what
 * lets a derived value sum beside the authored ones it belongs with.
 *
 * The unit rides the FORMULA, not the binding: the node reads `formula.unit` at bind time and
 * embeds it into the event's recipe, and an inline expression has nowhere to declare one. So the
 * write side is one optional field on one form, and everything else is read-side.
 */

const stamp = () => `e2e-${Date.now()}`

/** The value rendered under the "Result unit" label — the Fact carries no testid of its own. */
const unitFact = (page: import('@playwright/test').Page) =>
  page
    .getByRole('dialog')
    .locator('div')
    .filter({ has: page.getByText('Result unit', { exact: true }) })
    .last()
    .locator('span')
    .last()

test.describe('16 - rollups / formula units', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/formulas')
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('FU1: a declared unit is optional, and says so', async ({ page }) => {
    await tour(page, 'formulasCreate').click()

    // Optional and SECONDARY by design: the node infers a unit wherever the expression preserves
    // one (`weight * 1.1` stays kg), so a declaration matters only where inference cannot help —
    // a width times a height, or a result in a different scale than its inputs.
    await expect(page.getByTestId('unit-picker')).toBeVisible()
    await expect(page.getByText(/optional/i).first()).toBeVisible()
  })

  test('FU2: a formula declaring a unit shows it, one that does not says it is inferred', async ({
    page,
  }) => {
    const declared = `${stamp()}-fu2`

    await tour(page, 'formulasCreate').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/name/i).first().fill(declared)
    await dialog.getByLabel(/expression/i).fill('a * b')

    await page.getByTestId('unit-picker').click()
    await page.getByTestId('unit-option-m2').click()

    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()

    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: declared })
      .first()
    await expect(row).toBeVisible()
    await row.getByTestId('formula-details-button').click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Scoped to the Result unit block. A bare `getByText('m2')` passes against the unit PICKER
    // and anything else on the page — declaring kg instead still went green, so the assertion was
    // measuring the wrong element.
    await expect(unitFact(page)).toHaveText('m2')
  })

  test('FU2b: a formula with no declaration reads as inferred, not as blank', async ({
    page,
  }) => {
    const inferred = `${stamp()}-fu2b`

    await tour(page, 'formulasCreate').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/name/i).first().fill(inferred)
    await dialog.getByLabel(/expression/i).fill('a * 1.1')

    await page
      .getByRole('button', { name: /create formula/i })
      .last()
      .click()

    const row = page
      .getByTestId('data-table-row')
      .filter({ hasText: inferred })
      .first()
    await expect(row).toBeVisible()
    await row.getByTestId('formula-details-button').click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // An empty unit is not "no unit" — the taint walk carries one through a multiplicative scalar,
    // so `a * 1.1` inherits whatever `a` is in. Rendering a blank would read as unitless, which is
    // the exact state the declaration exists to avoid.
    await expect(unitFact(page)).toHaveText(/worked out from the values/i)
  })
})
