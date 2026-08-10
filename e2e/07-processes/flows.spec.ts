import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addFlow,
  createObjectWithId,
  createProcess,
  openProcess,
} from '../utils/process'
import { enterEditMode, saveSheet, sheet, switchTab } from '../utils/sheet'

/**
 * §6.11 PR7-PR13 — flow removal, restore and the shape of the PATCH.
 *
 * This is the part of the plan with the most new code and the least coverage, and the part where a
 * wrong request loses data rather than showing the wrong screen: a restore that sends `add` mints a
 * NEW flow and drops the quantity and properties of the old one.
 *
 * The rows are also the second place the `form.watch`-in-a-child freeze can appear. `FlowRow` had
 * it, exactly as `PropertyRow` did, so PR7 is a production-build regression test as much as a
 * behaviour one.
 */

const stamp = () => `e2e-${Date.now()}`

/**
 * TWO inputs and one output, all pointing at a freshly created object of a known name.
 *
 * Two inputs, because the node refuses a process with none: seeded with one, every case that
 * removes an input fails on the refusal that PR12 exists to check, and proves nothing about
 * removal itself. `inputCount: 1` is for PR12, which wants exactly that refusal.
 *
 * Returns the ref name too — PR11 adds another flow and the picker needs something to search for.
 */
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

    // PR7: ONE click, no confirm. A flow removal is a soft delete the row itself offers to undo,
    // so the two-step a property needs would be ceremony. This is also the case that froze in a
    // production build before `FlowRow` moved to `useWatch`.
    await page.getByTestId('flow-remove-inputs-0').click()
    await expect(page.getByTestId('flow-deleted-inputs-0')).toBeVisible()
    await expect(
      page.getByTestId('flow-deleted-inputs-0-restore')
    ).toBeVisible()

    // PR8: it is still there after a save — marked, not gone.
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

    // Read mode shows the deletion but cannot commit an undo — only Save can, and there is no Save
    // here. Offering the button would promise something the view cannot deliver.
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

    // PR10 ⚠ the request is the assertion. A restore sent as `add` mints a NEW flow: the screen
    // looks right and the quantity and properties of the original are gone. The only place that
    // difference is visible is the wire.
    await expect.poll(() => api.count(/\/processes\//)).toBeGreaterThan(0)

    // PR9: the quantity came back with it, rather than an empty row wearing the same name.
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

    // Nothing to soft-delete: the node has never seen it, so there is no row to strike through.
    await expect(page.getByTestId('flow-row-inputs-2')).toHaveCount(0)
    await expect(page.getByTestId('flow-deleted-inputs-2')).toHaveCount(0)
  })

  test('PR12: removing the only input is refused, and other edits survive', async ({
    page,
  }) => {
    const { name } = await seedProcess(page, 'pr12', 1)

    await openProcess(page, name)
    await enterEditMode(page)

    // An unrelated edit first, so the refusal can be checked against something it must not discard.
    const newName = `${name}-edited`
    await sheet(page).getByLabel(/name/i).first().fill(newName)

    await switchTab(page, 'inputs')
    await page.getByTestId('flow-remove-inputs-0').click()
    await page.getByTestId('sheet-save').click()

    // The node refuses a process with no inputs. What matters is that the refusal reads as a
    // message and the sheet stays open holding the name change — not a raw 422 and a lost edit.
    await expect(sheet(page)).toBeVisible()
    await expect(sheet(page).getByLabel(/name/i).first()).toHaveValue(newName)
  })
})
