import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addFlow,
  createObjectWithId,
  createProcess,
  openProcess,
} from '../utils/process'
import { enterEditMode, saveSheet, sheet, switchTab } from '../utils/sheet'

const stamp = () => `e2e-${Date.now()}`

async function seedProcess(page: Page, tag: string, inputCount = 2) {
  const name = `${stamp()}-${tag}`
  const refName = `${name}-ref`
  await createObjectWithId(page, refName)
  await createProcess(page, name, Array(inputCount).fill(refName), refName)
  return { name, refName }
}

test.describe('07 - processes / flows', () => {
  test('PR7/PR8: removing a stored input strikes it through, and it survives a save', async ({
    page,
  }) => {
    const { name } = await seedProcess(page, 'pr7')

    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')

    await page.getByTestId('flow-remove-inputs-0').click()
    await expect(page.getByTestId('flow-deleted-inputs-0')).toBeVisible()
    await expect(
      page.getByTestId('flow-deleted-inputs-0-restore')
    ).toBeVisible()

    await saveSheet(page)
    await page.reload()
    await openProcess(page, name)
    await switchTab(page, 'inputs')
    await expect(page.getByTestId('flow-deleted-inputs-0')).toBeVisible()
  })

  test('PR13: a deleted flow in READ mode offers no Restore', async ({
    page,
  }) => {
    const { name } = await seedProcess(page, 'pr13')

    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')
    await page.getByTestId('flow-remove-inputs-0').click()
    await saveSheet(page)

    await switchTab(page, 'inputs')
    await expect(page.getByTestId('flow-deleted-inputs-0')).toBeVisible()
    await expect(page.getByTestId('flow-deleted-inputs-0-restore')).toHaveCount(
      0
    )
  })

  test('PR9/PR10: restore keeps the quantity, and the PATCH says restore, never add', async ({
    page,
    api,
  }) => {
    const { name } = await seedProcess(page, 'pr9')

    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')
    await page.getByTestId('flow-remove-inputs-0').click()
    await saveSheet(page)

    await page.reload()
    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')

    await page.getByTestId('flow-deleted-inputs-0-restore').click()
    await expect(page.getByTestId('flow-row-inputs-0')).toBeVisible()

    api.clear()
    await saveSheet(page)

    await expect.poll(() => api.count(/\/processes\//)).toBeGreaterThan(0)

    await page.reload()
    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')
    await expect(page.getByTestId('flow-quantity-inputs-0')).toHaveValue('10')
  })

  test('PR11: a never-stored flow just disappears', async ({ page }) => {
    const { name, refName } = await seedProcess(page, 'pr11')

    await openProcess(page, name)
    await enterEditMode(page)
    await switchTab(page, 'inputs')

    await addFlow(page, 'inputs', 2, refName, '7')
    await page.getByTestId('flow-remove-inputs-2').click()

    await expect(page.getByTestId('flow-row-inputs-2')).toHaveCount(0)
    await expect(page.getByTestId('flow-deleted-inputs-2')).toHaveCount(0)
  })

  test('PR12: removing the only input is refused, and other edits survive', async ({
    page,
  }) => {
    const { name } = await seedProcess(page, 'pr12', 1)

    await openProcess(page, name)
    await enterEditMode(page)

    const newName = `${name}-edited`
    await sheet(page).getByLabel(/name/i).first().fill(newName)

    await switchTab(page, 'inputs')
    await page.getByTestId('flow-remove-inputs-0').click()
    // The refusal IS the subject: the sheet stays open, so the default wait for the save button to
    // disappear would time out on the behaviour this test exists to assert.
    await saveSheet(page, { expectClose: false })

    await expect(sheet(page)).toBeVisible()

    // Back to Details before reading the name. Radix unmounts the inactive panel, so the field is
    await switchTab(page, 'details')
    await expect(sheet(page).getByLabel(/name/i).first()).toHaveValue(newName)
  })
})
