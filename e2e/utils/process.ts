import { expect, type Page } from '@playwright/test'

import { tour } from './selectors'
import { gotoList, saveSheet, sheet, switchTab } from './sheet'

export type Bag = 'inputs' | 'outputs'

export async function createObjectWithId(
  page: Page,
  name: string
): Promise<string> {
  // `gotoList`, not goto + expect: `page.goto` resolves before React tears the previous route
  // down, so for a moment BOTH tables carry `data-testid="data-table"` and the bare assertion dies
  // on a strict-mode violation that reads like a duplicate testid.
  await gotoList(page, '/objects')

  await tour(page, 'createObject').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  await panel.getByLabel(/name/i).first().fill(name)
  await saveSheet(page)
  await expect(panel).toBeHidden()

  const row = page
    .getByTestId('data-table-row')
    .filter({ hasText: name })
    .first()
  await expect(row).toBeVisible()
  await row.dblclick()
  await expect(page).toHaveURL(/\/objects\/[0-9a-f-]{8,}/i)

  return page.url().split('/').pop() as string
}

export async function addFlow(
  page: Page,
  bag: Bag,
  index: number,
  objectName: string,
  quantity: string
): Promise<void> {
  await page.getByTestId(`add-${bag.slice(0, -1)}`).click()

  const row = page.getByTestId(`flow-row-${bag}-${index}`)
  await expect(row).toBeVisible()

  await row.getByTestId('object-picker').click()
  await page.getByTestId('object-picker-search').fill(objectName)

  const option = page
    .locator('[data-testid^="object-option-"]')
    .filter({ hasText: objectName })
    .first()
  await expect(option).toBeVisible()
  await option.click()

  await page.getByTestId(`flow-quantity-${bag}-${index}`).fill(quantity)
}

export async function createProcess(
  page: Page,
  name: string,
  inputNames: string[],
  outputName: string
): Promise<void> {
  await gotoList(page, '/processes')

  await tour(page, 'processesCreate').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  await panel.getByLabel(/name/i).first().fill(name)

  await switchTab(page, 'inputs')
  for (const [index, inputName] of inputNames.entries()) {
    await addFlow(page, 'inputs', index, inputName, '10')
  }

  await switchTab(page, 'outputs')
  await addFlow(page, 'outputs', 0, outputName, '4')

  await saveSheet(page)
  await expect(panel).toBeHidden()
}

export function processRow(page: Page, name: string) {
  return page.getByTestId('data-table-row').filter({ hasText: name }).first()
}

export async function openProcess(page: Page, name: string): Promise<void> {
  await processRow(page, name).getByTestId('process-details-button').click()
  await expect(sheet(page)).toBeVisible()
}
