import { expect, type Page } from '@playwright/test'

import { tour } from './selectors'
import { gotoList, openDialog } from './sheet'

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** Formulas are immutable, so each run mints its own rather than binding to a shared one. */
export async function createFormula(
  page: Page,
  name: string,
  expression: string,
  resultUnit?: string
): Promise<void> {
  await gotoList(page, '/formulas')
  await tour(page, 'formulasCreate').click()
  const dialog = await openDialog(page)
  await dialog.getByLabel(/name/i).first().fill(name)
  await dialog.getByLabel(/expression/i).fill(expression)
  if (resultUnit) {
    await page.getByTestId('unit-picker').click()
    await page.getByTestId(`unit-option-${resultUnit}`).click()
  }
  await page
    .getByRole('button', { name: /create formula/i })
    .last()
    .click()
  await expect(rowFor(page, name)).toHaveCount(1)
}

/** Switch value 0 of `index` into formula mode and choose `formulaName`. */
export async function chooseFormula(
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

export async function bind(
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
