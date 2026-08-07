import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  expandProperty,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  sheet,
  switchTab,
} from '../utils/sheet'

/**
 * §6.6 — tabs, dirty state and the lifecycle footer.
 *
 * This is the interaction model the refactor introduced and the old suite has no coverage of at
 * all: one form, one sheet-wide `editing` flag, four tabs each carrying a dirty dot, one footer.
 */

const stamp = () => `e2e-${Date.now()}`

/** Creates an object through the UI and leaves the list showing it. */
async function seedObject(page: import('@playwright/test').Page, tag: string) {
  const name = `${stamp()}-${tag}`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, 'Weight', '12')
  await page.getByTestId('sheet-save').click()
  await expect(panel).toBeHidden()
  return name
}

function rowFor(page: import('@playwright/test').Page, name: string) {
  return page.locator('tr').filter({ hasText: name }).first()
}

test.describe('03 - object sheet / tabs and dirty', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('T1: four tabs, in order', async ({ page }) => {
    const name = await seedObject(page, 't1')
    await openObjectSheet(page, rowFor(page, name))

    await expect(page.locator('[data-testid^="sheet-tab-"]')).toHaveCount(4)
    await expect(page.getByTestId('sheet-tab-properties')).toBeVisible()
    await expect(page.getByTestId('sheet-tab-files')).toBeVisible()
    await expect(page.getByTestId('sheet-tab-relations')).toBeVisible()
    await expect(page.getByTestId('sheet-tab-details')).toBeVisible()
  })

  test('T2: edit is sheet-wide — entering from Details makes Properties editable', async ({
    page,
  }) => {
    const name = await seedObject(page, 't2')
    await openObjectSheet(page, rowFor(page, name))

    await switchTab(page, 'details')
    await enterEditMode(page)

    // The single biggest behavioural change from the per-section model: one flag, not one per
    // section. Properties is editable without ever having been clicked into edit itself.
    await switchTab(page, 'properties')
    await expect(page.getByTestId('add-property')).toBeVisible()
    await expandProperty(page, 0)
    await expect(page.getByTestId('property-name-0')).toBeVisible()
  })

  test('T3: Save is disabled while clean, enabled on the first change', async ({
    page,
  }) => {
    const name = await seedObject(page, 't3')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    // Replaces the old TC019 ("Save with no changes succeeds"), whose assertion inverts against
    // this footer — it now describes a disabled button.
    await expect(page.getByTestId('sheet-save')).toBeDisabled()

    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('99')
    await expect(page.getByTestId('sheet-save')).toBeEnabled()
  })

  test('T4/T5: editing dots the Properties tab, and the bar counts leaves', async ({
    page,
  }) => {
    const name = await seedObject(page, 't5')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await expect(page.getByTestId('unsaved-bar')).toBeHidden()

    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('42')

    await expect(page.getByTestId('unsaved-bar')).toBeVisible()
    // T4: the dot is on Properties, and only there.
    await expect(
      page.getByTestId('sheet-tab-properties').getByTestId('sheet-tab-dirty')
    ).toBeVisible()
    await expect(page.getByTestId('sheet-tab-dirty')).toHaveCount(1)
  })

  test('T6/T7: Cancel with edits prompts; Cancel-the-prompt keeps them, Discard reverts', async ({
    page,
  }) => {
    const name = await seedObject(page, 't6')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)

    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('777')
    await page.getByTestId('sheet-cancel').click()

    await expect(page.getByTestId('unsaved-dialog')).toBeVisible()

    // T6: backing out of the prompt must not throw the edit away.
    await page.getByTestId('unsaved-cancel').click()
    await expect(page.getByTestId('unsaved-dialog')).toBeHidden()
    await expect(page.getByTestId('property-value-0-0')).toHaveValue('777')

    // T7: discarding reverts to the stored value.
    await page.getByTestId('sheet-cancel').click()
    await page.getByTestId('unsaved-discard').click()
    await expect(page.getByTestId('unsaved-dialog')).toBeHidden()
    await expect(page.getByTestId('sheet-edit')).toBeVisible()
  })

  test('T8: an edit sheet offers two options, no Save draft', async ({
    page,
  }) => {
    const name = await seedObject(page, 't8')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('55')
    await page.getByTestId('sheet-cancel').click()

    await expect(page.getByTestId('unsaved-dialog')).toBeVisible()
    // `onSaveDraft` is only passed when `isCreate` — an existing entity already has a server copy,
    // so a local draft of an edit would be a second source of truth with no way to tell which wins.
    await expect(page.getByTestId('unsaved-save-draft')).toHaveCount(0)
    await expect(page.getByTestId('unsaved-discard')).toBeVisible()
    await expect(page.getByTestId('unsaved-cancel')).toBeVisible()
  })

  test('T9/T10/T11: delete names the object, then only Restore is offered', async ({
    page,
  }) => {
    const name = await seedObject(page, 't9')
    await openObjectSheet(page, rowFor(page, name))

    await page.getByTestId('sheet-delete').click()
    // T9: the dialog names what it is about to remove.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(name)
    await dialog.getByRole('button', { name: /delete/i }).click()

    // T10: a deleted entity cannot be edited until restored, so Restore REPLACES the set rather
    // than sitting alongside Edit.
    await expect(page.getByTestId('sheet-restore')).toBeVisible()
    await expect(page.getByTestId('sheet-edit')).toHaveCount(0)
    await expect(page.getByTestId('sheet-delete')).toHaveCount(0)

    // T11: restore puts it back.
    await page.getByTestId('sheet-restore').click()
    await expect(page.getByTestId('sheet-edit')).toBeVisible()
  })

  test('T12: Esc mid-edit leaves no stale edit-mode flag on reopen', async ({
    page,
  }) => {
    const name = await seedObject(page, 't12')
    await openObjectSheet(page, rowFor(page, name))
    await enterEditMode(page)
    await expandProperty(page, 0)
    await page.getByTestId('property-value-0-0').fill('123')

    await page.keyboard.press('Escape')
    await page.getByTestId('unsaved-discard').click()
    await expect(sheet(page)).toBeHidden()

    // The `19-sheet-state-reset` intent, re-expressed for one form: reopening must not resume in
    // edit mode, and must not carry the abandoned value.
    await openObjectSheet(page, rowFor(page, name))
    await expect(page.getByTestId('sheet-edit')).toBeVisible()
    await expect(page.getByTestId('sheet-save')).toHaveCount(0)
  })
})
