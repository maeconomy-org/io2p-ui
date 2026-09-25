import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { createObjectWithId, processRow } from '../utils/process'
import { tour } from '../utils/selectors'
import { addProperty, saveSheet, sheet, switchTab } from '../utils/sheet'

/**
 * What a process refuses, and whether it lets you recover.
 *
 * Four rules live in `use-process-form.ts`'s submit: a nameless property, a flow with no object, an
 * emptied direction, and the server's own verdict. The first three return EARLY, so nothing reaches
 * the node — they are the UI compensating for its own builders, which drop a nameless property
 * rather than sending it. That makes the recovery path as important as the refusal: a refusal you
 * cannot clear is worse than no validation at all, because the guard holds the work hostage instead
 * of protecting it.
 */

const stamp = () => `e2e-${Date.now()}`

/** Sonner renders an `<li>` inside `ol[data-sonner-toaster]`; it carries no `status` role. */
const toast = (page: Page) => page.locator('[data-sonner-toaster] li')

async function openCreate(page: Page, name: string) {
  await page.goto('/processes')
  await expect(page.getByTestId('data-table')).toBeVisible()
  await tour(page, 'processesCreate').click()
  const panel = sheet(page)
  await expect(panel).toBeVisible()
  await panel.getByLabel(/name/i).first().fill(name)
  return panel
}

test.describe('07 - processes / validation', () => {
  test('PV1: a flow with no object is refused', async ({ page }) => {
    const name = `${stamp()}-pv1`
    await openCreate(page, name)

    await switchTab(page, 'inputs')
    await page.getByTestId('add-input').click()
    await expect(page.getByTestId('flow-row-inputs-0')).toBeVisible()

    // The row exists but points at nothing. `findFlowWithoutRef` catches it before the request.
    await saveSheet(page, { expectClose: false })
    await expect(toast(page)).toContainText(/object/i)
    await expect(sheet(page)).toBeVisible()
  })

  test('PV2: picking an object clears the refusal', async ({ page }) => {
    const name = `${stamp()}-pv2`
    const objectName = `${stamp()}-pv2-obj`
    await createObjectWithId(page, objectName)

    await openCreate(page, name)
    await switchTab(page, 'inputs')
    await page.getByTestId('add-input').click()
    await saveSheet(page, { expectClose: false })
    await expect(toast(page)).toContainText(/object/i)

    // PV1's recovery half, and the case that matters most: `setError` is set BY HAND in the submit
    // handler, and `setValue` does not clear a manually set error. If the picker does not clear it,
    // the sheet stays refused after the user has done exactly what the message asked.
    const row = page.getByTestId('flow-row-inputs-0')
    await row.getByTestId('object-picker').click()
    await page.getByTestId('object-picker-search').fill(objectName)
    const option = page
      .locator('[data-testid^="object-option-"]')
      .filter({ hasText: objectName })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await row.getByTestId('flow-quantity-inputs-0').fill('5')

    await switchTab(page, 'outputs')
    await page.getByTestId('add-output').click()
    const out = page.getByTestId('flow-row-outputs-0')
    await out.getByTestId('object-picker').click()
    await page.getByTestId('object-picker-search').fill(objectName)
    const outOption = page
      .locator('[data-testid^="object-option-"]')
      .filter({ hasText: objectName })
      .first()
    await expect(outOption).toBeVisible()
    await outOption.click()
    await out.getByTestId('flow-quantity-outputs-0').fill('2')

    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(processRow(page, name)).toBeVisible()
  })

  test('PV3: a property with a value but no name is refused here too', async ({
    page,
  }) => {
    const name = `${stamp()}-pv3`
    await openCreate(page, name)

    // The process form runs the SAME `findEmptyPropertyKey` guard as the object sheet. Asserted
    // separately because it is a second submit handler with its own copy of the rule. Properties
    // live under Details here — a process sheet has no Properties tab.
    await addProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('42')

    await saveSheet(page, { expectClose: false })
    await expect(toast(page)).toContainText(/give every property a name/i)
    await expect(sheet(page)).toBeVisible()
  })
})
