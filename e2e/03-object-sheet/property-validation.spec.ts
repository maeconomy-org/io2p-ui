import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
  sheet,
} from '../utils/sheet'

/**
 * What happens when a property name is WRONG — the half the rewrite never carried across.
 *
 * The old suite had TC021/TC022 and a dictionary round-trip pair; the current suite covers the
 * happy paths and the state machine but asserts nothing about invalid input here.
 *
 * The refusal is the UI's own rule, NOT the node's: `PropertyInputShape.key` is a plain
 * `Type.String()` with no `minLength`, so core would accept an empty key. What forces it is that
 * `draft.ts:310` filters nameless properties out of the payload — so without the guard the user
 * types a value, sees a success toast, and the property was never sent.
 */

const stamp = () => `e2e-${Date.now()}`

const rowFor = (page: Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

/** Sonner renders an `<li>` inside `ol[data-sonner-toaster]`; it carries no `status` role. */
const toast = (page: Page) => page.locator('[data-sonner-toaster] li')

test.describe('03 - object sheet / property validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
  })

  test('PVAL1: a property with a value but no name refuses the save', async ({
    page,
  }) => {
    const name = `${stamp()}-pval1`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('42')

    await saveSheet(page, { expectClose: false })

    // Refused, not silently dropped. The sheet stays open so the work is still there to fix.
    await expect(toast(page)).toContainText(/give every property a name/i)
    await expect(sheet(page)).toBeVisible()
  })

  test('PVAL2: naming it lets the same save through', async ({ page }) => {
    const name = `${stamp()}-pval2`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('42')
    await saveSheet(page, { expectClose: false })
    await expect(toast(page)).toContainText(/give every property a name/i)

    // PVAL1's inversion guard: without this the refusal could be unconditional and PVAL1 would
    // pass against a build that never saves at all.
    await page.getByTestId('property-name-0').fill('weight')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()
    await expect(rowFor(page, name)).toBeVisible()
  })

  test('PVAL3: clearing a stored property name blocks the save', async ({
    page,
  }) => {
    const name = `${stamp()}-pval3`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await fillProperty(page, 0, 'weight', '10 kg')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    // The edit-mode twin, and the sharper case: the property already EXISTS, so an accepted save
    // would drop a stored property rather than merely losing an unsaved one.
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-name-0').fill('')
    await saveSheet(page, { expectClose: false })

    await expect(toast(page)).toContainText(/give every property a name/i)
    // Still in EDIT mode — a save that returned the sheet to read mode would have committed.
    await expect(page.getByTestId('sheet-save')).toBeVisible()
  })

  test('PVAL4: a dictionary pick round-trips as its label, never the key', async ({
    page,
  }) => {
    const name = `${stamp()}-pval4`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await page.getByTestId('property-name-0').fill('weig')
    const suggestion = page.getByTestId('property-name-suggestion-weight')
    await expect(suggestion).toBeVisible()
    await suggestion.click()

    await page.getByTestId('property-value-0-0').fill('10 kg')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    // The stored KEY is `weight`; the displayed LABEL is `Weight`. The kebab key must never reach
    // the reader — key is identity, label is language, and leaking the former is the "wrong
    // property name shown" bug this pins.
    await openObjectSheet(page, rowFor(page, name))
    await expect(sheet(page).getByText('Weight', { exact: true })).toBeVisible()
    await expect(sheet(page).getByText('weight', { exact: true })).toHaveCount(
      0
    )
  })

  test('PVAL5: a freeform name is stored verbatim', async ({ page }) => {
    const name = `${stamp()}-pval5`
    // Novel enough that the dictionary offers nothing, and mixed-case so a coercion to the
    // canonical key would be visible.
    const freeform = 'Torsion Damping Coefficient'

    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await addProperty(page, 0)
    await fillProperty(page, 0, freeform, '7')
    await saveSheet(page)
    await expect(sheet(page)).toBeHidden()

    await openObjectSheet(page, rowFor(page, name))
    await expect(sheet(page).getByText(freeform, { exact: true })).toBeVisible()
  })
})
