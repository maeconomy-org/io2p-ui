import { expect, test } from '../fixtures/app'
import { addProperty, fillProperty, openCreateSheet } from '../utils/sheet'

/**
 * §6.5 — the create flow.
 *
 * The premise that changed: create renders NO tabs. `entity-sheet.tsx` passes
 * `tabs={isCreate ? undefined : tabs}`, so the create shell is the linear `CreateForm` and any
 * spec that clicks a tab during creation is wrong by construction (C2).
 */

const stamp = () => `e2e-${Date.now()}`

test.describe('03 - object sheet / create', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/objects')
  })

  test('C2: the create sheet renders no tabs', async ({ page }) => {
    await openCreateSheet(page)

    // The linear-vs-tabbed fork. Asserting the COUNT rather than one tab's absence: a partial
    // regression that rendered only Properties would slip past `not.toBeVisible()` on Files.
    await expect(page.locator('[data-testid^="sheet-tab-"]')).toHaveCount(0)
  })

  test('C3: Save is disabled until something is entered', async ({ page }) => {
    await openCreateSheet(page)

    // `disabled={isSubmitting || !isDirty}`. This is what "an empty form cannot be submitted" means
    // now — the old spec clicked Save and asserted an error, which against this footer just waits
    // 60s on a button that never becomes clickable.
    await expect(page.getByTestId('sheet-save')).toBeDisabled()
  })

  test('C4: a whitespace-only name is rejected once the form is dirty', async ({
    page,
  }) => {
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill('   ')

    const save = page.getByTestId('sheet-save')
    await expect(save).toBeEnabled()
    await save.click()

    // Still open — the failure worth catching is a submit that closes the sheet having created
    // nothing, or created an object named three spaces.
    await expect(panel).toBeVisible()
    await expect(save).toBeVisible()
  })

  test('C1: name only — created, and it appears in the list', async ({
    page,
  }) => {
    const name = `${stamp()}-c1`
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill(name)
    await page.getByTestId('sheet-save').click()

    await expect(panel).toBeHidden()
    await expect(page.getByRole('cell', { name, exact: false })).toBeVisible()
  })

  test('C5: name plus two properties round-trips', async ({ page }) => {
    const name = `${stamp()}-c5`
    const panel = await openCreateSheet(page)

    await panel.getByLabel(/name/i).first().fill(name)

    await addProperty(page, 0)
    await fillProperty(page, 0, 'Weight', '12 kg')
    await addProperty(page, 1)
    await fillProperty(page, 1, 'Colour', 'red')

    await page.getByTestId('sheet-save').click()
    await expect(panel).toBeHidden()

    await expect(page.getByRole('cell', { name, exact: false })).toBeVisible()
  })
})
